/**
 * Hook: manages generation queue from DB with realtime updates.
 * Jobs are created SERVER-SIDE in start-generation — this hook only reads and polls.
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

/**
 * Smooth simulated progress
 */
function createSmoothProgress(startFrom = 5) {
  let current = startFrom;
  let phase: "waiting" | "queuing" | "generating" | "finalizing" = "waiting";

  return {
    update(providerProgress: number | undefined, state: string | undefined) {
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
        current = Math.max(current, 30 + (providerProgress / 100) * 65);
        return { progress: Math.min(Math.round(current), 95), phase };
      }

      const maxForPhase = phase === "waiting" ? 25 : phase === "queuing" ? 40 : phase === "generating" ? 90 : 95;
      const increment = phase === "waiting" ? 0.8 : phase === "queuing" ? 1.2 : phase === "generating" ? 1.5 : 0.5;

      if (current < maxForPhase) {
        const remaining = maxForPhase - current;
        const step = Math.min(increment, remaining * 0.08);
        current += Math.max(step, 0.2);
      }

      return { progress: Math.min(Math.round(current * 10) / 10, 95), phase };
    },
    reset(val = 5) {
      current = val;
      phase = "waiting";
    },
  };
}

const phaseLabels: Record<string, string> = {
  waiting: "في الانتظار...",
  queuing: "في قائمة الانتظار...",
  generating: "جاري التوليد...",
  finalizing: "جاري الإنهاء...",
};

export function useGenerationQueue() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const pollingRefs = useRef<Map<string, boolean>>(new Map());

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
      setJobs(data as unknown as GenerationJob[]);
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
    if (job && job.status === "succeeded" && job.result_url && user) {
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
  ) => {
    if (!job.task_id) return;
    if (pollingRefs.current.get(job.id)) return;
    pollingRefs.current.set(job.id, true);

    const smooth = createSmoothProgress(job.progress || 5);
    const apiType = (job.api_type || "standard") as ApiType;

    updateJobLocal(job.id, { status: "running" as JobStatus, progress: 10 });
    await updateJobDB(job.id, { status: "running", progress: 10 });

    let latestState = "waiting";
    let latestProgress: number | undefined;
    const progressInterval = setInterval(() => {
      const { progress: simProg, phase } = smooth.update(latestProgress, latestState);
      updateJobLocal(job.id, {
        progress: Math.round(simProg),
        metadata: { ...job.metadata, phaseLabel: phaseLabels[phase] || phase },
      });
    }, 800);

    try {
      const result = await pollTask(
        job.task_id,
        (state, prog) => {
          latestState = state;
          latestProgress = prog;
          const { progress: simProg } = smooth.update(prog, state);
          updateJobDB(job.id, { progress: Math.round(simProg), status: "running" });
        },
        180,
        3000,
        false,
        apiType,
      );

      clearInterval(progressInterval);

      if (result.resultJson) {
        const parsed = JSON.parse(result.resultJson);
        const resultUrl = parsed.resultUrls?.[0] || "";

        updateJobLocal(job.id, {
          status: "succeeded" as JobStatus,
          progress: 100,
          result_url: resultUrl,
          completed_at: new Date().toISOString(),
        });
        // DB update is handled by complete-generation edge function

        onSuccess?.(parsed.resultUrls || [], job);
      } else {
        throw new Error("No result returned");
      }
    } catch (err) {
      clearInterval(progressInterval);
      const msg = err instanceof Error ? err.message : "Unknown error";

      updateJobLocal(job.id, {
        status: "failed" as JobStatus,
        error_message: msg,
        completed_at: new Date().toISOString(),
      });
      // DB update is handled by complete-generation edge function

      onFail?.(msg, job);
    } finally {
      pollingRefs.current.delete(job.id);
    }
  }, [updateJobLocal, updateJobDB]);

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
          const newJob = payload.new as unknown as GenerationJob;
          if (payload.eventType === "INSERT") {
            setJobs((prev) => {
              if (prev.some((j) => j.id === newJob.id)) return prev;
              return [newJob, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setJobs((prev) =>
              prev.map((j) => (j.id === newJob.id ? newJob : j))
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

  // Auto-resume polling for pending/running jobs
  useEffect(() => {
    jobs.forEach((job) => {
      if (
        (job.status === "pending" || job.status === "running") &&
        job.task_id &&
        !pollingRefs.current.get(job.id)
      ) {
        pollJob(job);
      }
    });
  }, [jobs, pollJob]);

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
