/**
 * Global context for generation queue - shared across all pages.
 */
import { createContext, useContext, type ReactNode } from "react";
import { useGenerationQueue, type GenerationJob } from "@/hooks/use-generation-queue";

interface GenerationQueueContextValue {
  jobs: GenerationJob[];
  activeJobs: GenerationJob[];
  completedJobs: GenerationJob[];
  failedJobs: GenerationJob[];
  unseenJobs: GenerationJob[];
  activeCount: number;
  unseenCount: number;
  pollJob: (
    job: GenerationJob,
    onSuccess?: (resultUrls: string[], job: GenerationJob) => void,
    onFail?: (error: string, job: GenerationJob) => void,
    onProgress?: (progress: number, phaseLabel: string, state: string) => void,
  ) => Promise<void>;
  fetchJobs: () => Promise<void>;
  updateJobLocal: (jobId: string, updates: Partial<GenerationJob>) => void;
  markJobSeen: (jobId: string) => Promise<void>;
}

const GenerationQueueContext = createContext<GenerationQueueContextValue | null>(null);

export function GenerationQueueProvider({ children }: { children: ReactNode }) {
  const queue = useGenerationQueue();
  return (
    <GenerationQueueContext.Provider value={queue}>
      {children}
    </GenerationQueueContext.Provider>
  );
}

export function useQueue() {
  const ctx = useContext(GenerationQueueContext);
  if (!ctx) throw new Error("useQueue must be used within GenerationQueueProvider");
  return ctx;
}
