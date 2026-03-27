/**
 * Hook: manages generation queue from DB with realtime updates.
 * Jobs are created SERVER-SIDE in start-generation — this hook only reads and polls.
 * v2 — stabilized hook count for HMR compatibility.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { pollTask, type ApiType } from "@/lib/kie-ai";

export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "timed_out";
export type ProviderBillingState = "unknown" | "no_charge_confirmed" | "upstream_task_created" | "upstream_success_confirmed" | "upstream_failed_refunded_confirmed" | "upstream_failed_refund_unknown" | "user_refunded" | "manual_review_required";
export type ReconciliationStatus = "not_required" | "pending_review" | "resolved" | "escalated";

export interface GenerationJob {
  id: string;
  user_id: string;
  task_id: string | null;
  reservation_id: string | null;
  tool_id: string;
  tool_name: string | null;
  model: string;
  api_type: string;
  prompt: string | null;
  file_type: string;
  status: JobStatus;
  progress: number;
  result_url: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  seen_at: string | null;
  provider_billing_state: ProviderBillingState;
  reconciliation_status: ReconciliationStatus;
  provider_status_code: string | null;
  provider_status_message: string | null;
  reconciliation_notes: string | null;
}

type PollProgressCallback = (progress: number, phaseLabel: string, state: string) => void;
type PollSuccessCallback = (resultUrls: string[], job: GenerationJob) => void;
type PollFailCallback = (error: string, job: GenerationJob) => void;

interface JobPollListeners {
  success: Set<PollSuccessCallback>;
  fail: Set<PollFailCallback>;
  progress: Set<PollProgressCallback>;
}

/**
 * Smooth simulated progress
 */
function createSmoothProgress(startFrom = 0) {
  let current = startFrom;
  let phase: "waiting" | "queuing" | "generating" | "finalizing" = "waiting";
  let tickCount = 0;

  return {
    update(providerProgress: number | undefined, state: string | undefined) {
      tickCount++;
      const s = (state || "").toLowerCase();
      if (["success", "succeeded", "completed", "done"].includes(s)) {
        current = 100;
        phase = "finalizing";
        return { progress: 100, phase };
      }
      if (["fail", "failed", "error"].includes(s)) {
        return { progress: current, phase };
      }
      if (["generating", "running", "processing", "in_progress"].includes(s)) {
        phase = "generating";
      } else if (["queuing", "queue", "queued"].includes(s)) {
        phase = "queuing";
      } else if (["waiting", "pending", "submitted"].includes(s)) {
        phase = "waiting";
      }

      if (providerProgress && providerProgress > 0) {
        const mapped = 20 + (providerProgress / 100) * 75;
        current = Math.max(current, mapped);
        return { progress: Math.min(Math.round(current), 95), phase };
      }

      // Smooth increments: fast early ramp, slowing as we approach ceiling
      const maxForPhase = phase === "waiting" ? 30 : phase === "queuing" ? 50 : phase === "generating" ? 92 : 95;
      const baseSpeed = phase === "waiting" ? 1.8 : phase === "queuing" ? 1.5 : phase === "generating" ? 1.2 : 0.4;

      if (current < maxForPhase) {
        const remaining = maxForPhase - current;
        // Ease-out: faster when far from target, slower near it
        const step = Math.max(remaining * 0.06, 0.3) * (baseSpeed / 1.5);
        current += Math.min(step, baseSpeed);
      }

      return { progress: Math.min(Math.round(current * 10) / 10, 95), phase };
    },
    reset(val = 0) {
      current = val;
      phase = "waiting";
      tickCount = 0;
    },
  };
}

const phaseLabels: Record<string, string> = {
  waiting: "في الانتظار...",
  queuing: "في قائمة الانتظار...",
  generating: "جاري التوليد...",
  finalizing: "جاري الإنهاء...",
};

/**
 * Derive the true status from all available signals.
 * Prevents flicker when DB status is stale but result/error fields are set.
 */
function getEffectiveStatus(job: { status: string; result_url?: string | null; completed_at?: string | null; error_message?: string | null }): JobStatus {
  if (job.result_url && !job.error_message) return "succeeded";
  if (job.completed_at && job.error_message) return "failed";
  if (job.completed_at && job.result_url) return "succeeded";
  return job.status as JobStatus;
}

function isTerminalStatus(s: string): boolean {
  return s === "succeeded" || s === "failed" || s === "timed_out";
}

export function useGenerationQueue() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const pollingRefs = useRef<Map<string, boolean>>(new Map());
  const pollListenersRef = useRef<Map<string, JobPollListeners>>(new Map());
  const selfHealedRef = useRef<Set<string>>(new Set());

  // Fetch jobs from DB (include recent completed for "unseen" tracking)
  const fetchJobs = useCallback(async () => {
    if (!user) return;
    // Fetch active + recent unseen completed/failed (last 24h)
    const { data, error } = await (supabase as any)
      .from("generation_jobs")
      .select("*")
      .eq("user_id", user.id)
      .or("status.in.(pending,running),and(status.in.(succeeded,failed,timed_out),completed_at.gte." + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() + ")")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      // Normalize effective status on fetch
      const normalized = (data as unknown as GenerationJob[]).map((j) => {
        const eff = getEffectiveStatus(j);
        return eff !== j.status ? { ...j, status: eff } : j;
      });
      setJobs(normalized);
    }
  }, [user]);

  // Update job in local state
  const updateJobLocal = useCallback((jobId: string, updates: Partial<GenerationJob>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j))
    );
  }, []);

  // Update job in DB
  const updateJobDB = useCallback(async (jobId: string, updates: Record<string, unknown>) => {
    await (supabase as any)
      .from("generation_jobs")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }, []);

  const finalizeJobServer = useCallback(async (
    job: GenerationJob,
    outcome:
      | { status: "success"; resultUrl: string }
      | { status: "failed"; errorMessage: string }
  ) => {
    const now = new Date().toISOString();

    if (!job.reservation_id) {
      if (outcome.status === "success") {
        await updateJobDB(job.id, {
          status: "succeeded",
          progress: 100,
          result_url: outcome.resultUrl,
          completed_at: now,
        });
      } else {
        await updateJobDB(job.id, {
          status: "failed",
          error_message: outcome.errorMessage,
          completed_at: now,
        });
      }
      return;
    }

    const body =
      outcome.status === "success"
        ? {
            reservationId: job.reservation_id,
            status: "success",
            taskId: job.task_id,
            toolId: job.tool_id,
            toolName: job.tool_name,
            prompt: job.prompt,
            fileUrl: outcome.resultUrl,
            fileType: job.file_type,
            metadata: job.metadata || {},
          }
        : {
            reservationId: job.reservation_id,
            status: "failed",
            errorMessage: outcome.errorMessage,
            providerFailState: outcome.errorMessage,
            providerStatusCode: null,
            providerStatusMessage: null,
          };

    const { error } = await supabase.functions.invoke("complete-generation", { body });
    if (error) {
      throw new Error(error.message);
    }
  }, [updateJobDB]);

  const registerPollListeners = useCallback((
    jobId: string,
    onSuccess?: PollSuccessCallback,
    onFail?: PollFailCallback,
    onProgress?: PollProgressCallback,
  ) => {
    if (!onSuccess && !onFail && !onProgress) return;

    const existing = pollListenersRef.current.get(jobId) || {
      success: new Set<PollSuccessCallback>(),
      fail: new Set<PollFailCallback>(),
      progress: new Set<PollProgressCallback>(),
    };

    if (onSuccess) existing.success.add(onSuccess);
    if (onFail) existing.fail.add(onFail);
    if (onProgress) existing.progress.add(onProgress);

    pollListenersRef.current.set(jobId, existing);
  }, []);

  const emitPollProgress = useCallback((jobId: string, progress: number, phaseLabel: string, state: string) => {
    const listeners = pollListenersRef.current.get(jobId);
    if (!listeners) return;
    listeners.progress.forEach((cb) => {
      try {
        cb(progress, phaseLabel, state);
      } catch (e) {
        console.warn("poll progress listener failed", e);
      }
    });
  }, []);

  const emitPollSuccess = useCallback((jobId: string, urls: string[], job: GenerationJob) => {
    const listeners = pollListenersRef.current.get(jobId);
    if (!listeners) return;
    listeners.success.forEach((cb) => {
      try {
        cb(urls, job);
      } catch (e) {
        console.warn("poll success listener failed", e);
      }
    });
  }, []);

  const emitPollFail = useCallback((jobId: string, message: string, job: GenerationJob) => {
    const listeners = pollListenersRef.current.get(jobId);
    if (!listeners) return;
    listeners.fail.forEach((cb) => {
      try {
        cb(message, job);
      } catch (e) {
        console.warn("poll fail listener failed", e);
      }
    });
  }, []);

  // Mark a job as seen AND move to library (generations table)
  const markJobSeen = useCallback(async (jobId: string) => {
    const now = new Date().toISOString();
    updateJobLocal(jobId, { seen_at: now });

    // Find the job to get its data for library insert
    const job = jobs.find((j) => j.id === jobId);

    // Update seen_at in generation_jobs
    await (supabase as any)
      .from("generation_jobs")
      .update({ seen_at: now, updated_at: now })
      .eq("id", jobId);

    // Insert into generations (library) only if succeeded and has result
    if (job && getEffectiveStatus(job) === "succeeded" && job.result_url && user) {
      await (supabase as any)
        .from("generations")
        .insert({
          user_id: user.id,
          tool_id: job.tool_id,
          tool_name: job.tool_name || null,
          prompt: job.prompt || null,
          file_url: job.result_url,
          file_type: job.file_type || "image",
          metadata: job.metadata || {},
          reservation_id: job.reservation_id,
        });
    }
  }, [updateJobLocal, jobs, user]);

  // Poll a specific job
  const pollJob = useCallback(async (
    job: GenerationJob,
    onSuccess?: (resultUrls: string[], job: GenerationJob) => void,
    onFail?: (error: string, job: GenerationJob) => void,
    onProgress?: PollProgressCallback,
  ) => {
    if (!job.task_id) return;
    registerPollListeners(job.id, onSuccess, onFail, onProgress);
    if (pollingRefs.current.get(job.id)) return;
    pollingRefs.current.set(job.id, true);

    const smooth = createSmoothProgress(Math.max(0, Math.min(job.progress || 1, 95)));
    const apiType = (job.api_type || "standard") as ApiType;
    const hasExternalHandlers = Boolean(onSuccess || onFail);

    updateJobLocal(job.id, {
      status: "running" as JobStatus,
      progress: Math.max(1, Math.min(job.progress || 1, 95)),
    });

    let latestState = "waiting";
    let latestProgress: number | undefined;
    const progressInterval = setInterval(() => {

      const { progress: simProg, phase } = smooth.update(latestProgress, latestState);
      const rounded = Math.round(simProg);
      updateJobLocal(job.id, {
        progress: rounded,
        metadata: { ...job.metadata, phaseLabel: phaseLabels[phase] || phase },
      });
      emitPollProgress(job.id, rounded, phaseLabels[phase] || phase, latestState);
    }, 500);

    try {
      const result = await pollTask(
        job.task_id,
        (state, prog) => {
          latestState = state;
          latestProgress = prog;
          const { progress: simProg } = smooth.update(prog, state);
          const rounded = Math.round(simProg);
          const normalizedState = String(state || "").toLowerCase();
          const isTerminalState = ["success", "succeeded", "completed", "done", "fail", "failed", "error", "timeout", "timed_out"].includes(normalizedState);
          if (!isTerminalState) {
            updateJobDB(job.id, { progress: rounded });
          }
          emitPollProgress(job.id, rounded, phaseLabels[state] || state, state);
        },
        180,
        3000,
        false,
        apiType,
      );

      clearInterval(progressInterval);

      if (result.resultJson) {
        let parsed: { resultUrls?: string[] };
        try {
          parsed = JSON.parse(result.resultJson);
        } catch {
          throw new Error("Invalid provider result payload");
        }

        const urls = Array.isArray(parsed.resultUrls)
          ? parsed.resultUrls.filter((u): u is string => typeof u === "string" && u.length > 0)
          : [];

        if (urls.length === 0) {
          throw new Error("Provider returned success without result URL");
        }

        const resultUrl = urls[0];
        const now = new Date().toISOString();

        updateJobLocal(job.id, {
          status: "succeeded" as JobStatus,
          progress: 100,
          result_url: resultUrl,
          updated_at: now,
          completed_at: now,
          metadata: { ...job.metadata, phaseLabel: phaseLabels.finalizing },
        });
        emitPollProgress(job.id, 100, phaseLabels.finalizing, "success");

        if (!hasExternalHandlers) {
          try {
            await finalizeJobServer(job, { status: "success", resultUrl });
          } catch {
            await updateJobDB(job.id, {
              status: "succeeded",
              progress: 100,
              result_url: resultUrl,
              completed_at: now,
            });
          }
        }

        emitPollSuccess(job.id, urls, job);
      } else {
        throw new Error("No result returned");
      }
    } catch (err) {
      clearInterval(progressInterval);
      const msg = err instanceof Error ? err.message : "Unknown error";
      const now = new Date().toISOString();
      const failedStatus: JobStatus = msg.toLowerCase().includes("timed out") ? "timed_out" : "failed";

      updateJobLocal(job.id, {
        status: failedStatus,
        error_message: msg,
        updated_at: now,
        completed_at: now,
      });
      emitPollProgress(job.id, Math.max(Math.round(job.progress || 0), 0), msg, "fail");

      if (!hasExternalHandlers) {
        try {
          await finalizeJobServer(job, { status: "failed", errorMessage: msg });
        } catch {
          await updateJobDB(job.id, {
            status: failedStatus,
            error_message: msg,
            completed_at: now,
          });
        }
      }

      emitPollFail(job.id, msg, job);
    } finally {
      pollingRefs.current.delete(job.id);
      pollListenersRef.current.delete(job.id);
    }
  }, [
    updateJobLocal,
    updateJobDB,
    finalizeJobServer,
    registerPollListeners,
    emitPollProgress,
    emitPollSuccess,
    emitPollFail,
  ]);

  // Fetch on mount
  useEffect(() => {
    if (!user) return;
    fetchJobs();
  }, [user, fetchJobs]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("generation-jobs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const rawJob = payload.new as unknown as GenerationJob;
          const incomingEffective = getEffectiveStatus(rawJob);
          const newJob = incomingEffective !== rawJob.status ? { ...rawJob, status: incomingEffective } : rawJob;

          if (payload.eventType === "INSERT") {
            setJobs((prev) => {
              if (prev.some((j) => j.id === newJob.id)) return prev;
              return [newJob, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setJobs((prev) =>
              prev.map((j) => {
                if (j.id !== newJob.id) return j;

                const localIsTerminal = isTerminalStatus(j.status);
                const incomingIsTerminal = isTerminalStatus(incomingEffective);

                // NEVER regress from terminal → active
                if (localIsTerminal && !incomingIsTerminal) {
                  return j;
                }

                // If local is terminal, only accept terminal updates (e.g. seen_at changes)
                if (localIsTerminal && incomingIsTerminal) {
                  return { ...j, ...newJob, status: j.status };
                }

                return newJob;
              })
            );
          } else if (payload.eventType === "DELETE") {
            setJobs((prev) => prev.filter((j) => j.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Auto-resume polling for genuinely active jobs only
  useEffect(() => {
    jobs.forEach((job) => {
      const eff = getEffectiveStatus(job);
      const isActive = eff === "pending" || eff === "running";

      if (isActive && job.task_id && !pollingRefs.current.get(job.id)) {
        pollJob(job);
      }

      // Self-heal: if DB status is active but effective is terminal, fix DB once
      if (!isActive && (job.status === "pending" || job.status === "running") && !selfHealedRef.current.has(job.id)) {
        selfHealedRef.current.add(job.id);
        const healUpdates: Record<string, unknown> = { status: eff, progress: 100 };
        if (!job.completed_at) healUpdates.completed_at = new Date().toISOString();
        updateJobDB(job.id, healUpdates);
      }
    });
  }, [jobs, pollJob, updateJobDB]);

  const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "running");
  const completedJobs = jobs.filter((j) => j.status === "succeeded");
  const failedJobs = jobs.filter((j) => j.status === "failed" || j.status === "timed_out");
  const unseenJobs = jobs.filter(
    (j) => (j.status === "succeeded" || j.status === "failed" || j.status === "timed_out") && !j.seen_at
  );

  return {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    unseenJobs,
    activeCount: activeJobs.length,
    unseenCount: unseenJobs.length,
    createJob: async () => null as any, // Deprecated - jobs are now created server-side
    pollJob,
    fetchJobs,
    updateJobLocal,
    markJobSeen,
  };
}
