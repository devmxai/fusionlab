/**
 * Hook: manages generation queue from DB with realtime updates.
 * Provides active jobs list, job creation, and auto-resume polling.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { pollTask, type ApiType } from "@/lib/kie-ai";

export type JobStatus = "pending" | "running" | "succeeded" | "failed" | "timed_out";

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
}

/**
 * Smooth simulated progress that gradually increases when
 * the provider doesn't return a numeric progress value.
 */
function createSmoothProgress(startFrom = 5) {
  let current = startFrom;
  let phase: "waiting" | "queuing" | "generating" | "finalizing" = "waiting";

  return {
    update(providerProgress: number | undefined, state: string | undefined) {
      // Map provider states to our phases
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

      // If provider gives numeric progress, use it (mapped to 30-95 range)
      if (providerProgress && providerProgress > 0) {
        current = Math.max(current, 30 + (providerProgress / 100) * 65);
        return { progress: Math.min(Math.round(current), 95), phase };
      }

      // Simulated smooth progress based on phase
      const maxForPhase = phase === "waiting" ? 25 : phase === "queuing" ? 40 : phase === "generating" ? 90 : 95;
      const increment = phase === "waiting" ? 0.8 : phase === "queuing" ? 1.2 : phase === "generating" ? 1.5 : 0.5;

      if (current < maxForPhase) {
        // Slow down as we approach the max — asymptotic
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

  // Fetch active jobs from DB
  const fetchJobs = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("generation_jobs")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pending", "running", "succeeded", "failed", "timed_out"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setJobs(data as unknown as GenerationJob[]);
    }
  }, [user]);

  // Create a new job record
  const createJob = useCallback(async (params: {
    taskId: string;
    reservationId: string;
    toolId: string;
    toolName: string;
    model: string;
    apiType: string;
    prompt: string;
    fileType: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (!user) return null;

    const jobRecord = {
      user_id: user.id,
      task_id: params.taskId,
      reservation_id: params.reservationId,
      tool_id: params.toolId,
      tool_name: params.toolName,
      model: params.model,
      api_type: params.apiType,
      prompt: params.prompt,
      file_type: params.fileType,
      status: "pending" as const,
      progress: 0,
      metadata: params.metadata || {},
    };

    const { data, error } = await (supabase as any)
      .from("generation_jobs")
      .insert(jobRecord)
      .select()
      .single();

    if (error) {
      console.error("Failed to create generation job:", error);
      return null;
    }

    const job = data as unknown as GenerationJob;
    setJobs((prev) => [job, ...prev]);
    return job;
  }, [user]);

  // Update job in local state
  const updateJobLocal = useCallback((jobId: string, updates: Partial<GenerationJob>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j))
    );
  }, []);

  // Update job in DB
  const updateJobDB = useCallback(async (jobId: string, updates: Record<string, unknown>) => {
    await supabase
      .from("generation_jobs")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }, []);

  // Poll a specific job
  const pollJob = useCallback(async (
    job: GenerationJob,
    onSuccess?: (resultUrls: string[], job: GenerationJob) => void,
    onFail?: (error: string, job: GenerationJob) => void,
  ) => {
    if (!job.task_id) return;
    if (pollingRefs.current.get(job.id)) return; // Already polling
    pollingRefs.current.set(job.id, true);

    const smooth = createSmoothProgress(job.progress || 5);
    const apiType = (job.api_type || "standard") as ApiType;

    // Update to running
    updateJobLocal(job.id, { status: "running" as JobStatus, progress: 10 });
    await updateJobDB(job.id, { status: "running", progress: 10 });

    // Set up progress simulation interval
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
          // Also update DB periodically
          const { progress: simProg } = smooth.update(prog, state);
          updateJobDB(job.id, { progress: Math.round(simProg), status: "running" });
        },
        180, // max attempts (9 min)
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
        await updateJobDB(job.id, {
          status: "succeeded",
          progress: 100,
          result_url: resultUrl,
          completed_at: new Date().toISOString(),
        });

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
      await updateJobDB(job.id, {
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      });

      onFail?.(msg, job);
    } finally {
      pollingRefs.current.delete(job.id);
    }
  }, [updateJobLocal, updateJobDB]);

  // Resume any in-progress jobs on mount
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

  return {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    activeCount: activeJobs.length,
    createJob,
    pollJob,
    fetchJobs,
    updateJobLocal,
  };
}
