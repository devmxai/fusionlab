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
  activeCount: number;
  createJob: (params: {
    taskId: string;
    reservationId: string;
    toolId: string;
    toolName: string;
    model: string;
    apiType: string;
    prompt: string;
    fileType: string;
    metadata?: Record<string, unknown>;
  }) => Promise<GenerationJob | null>;
  pollJob: (
    job: GenerationJob,
    onSuccess?: (resultUrls: string[], job: GenerationJob) => void,
    onFail?: (error: string, job: GenerationJob) => void,
  ) => Promise<void>;
  fetchJobs: () => Promise<void>;
  updateJobLocal: (jobId: string, updates: Partial<GenerationJob>) => void;
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
