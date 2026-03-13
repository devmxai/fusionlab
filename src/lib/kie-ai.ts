import { supabase } from "@/integrations/supabase/client";

export interface CreateTaskParams {
  model: string;
  input: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  model?: string;
  state?: "waiting" | "queuing" | "generating" | "success" | "fail";
  resultJson?: string;
  failMsg?: string;
  progress?: number;
}

export async function createTask(params: CreateTaskParams) {
  const { data, error } = await supabase.functions.invoke("kie-ai", {
    body: { action: "create", ...params },
  });
  if (error) throw new Error(error.message);
  if (data?.code !== 200) throw new Error(data?.msg || "Failed to create task");
  return data.data as { taskId: string };
}

export async function getTaskStatus(taskId: string): Promise<TaskResult> {
  const { data, error } = await supabase.functions.invoke("kie-ai", {
    body: { action: "status", taskId },
  });
  if (error) throw new Error(error.message);
  if (data?.code !== 200) throw new Error(data?.msg || "Failed to get status");
  return data.data as TaskResult;
}

export async function getCredits(): Promise<number> {
  const { data, error } = await supabase.functions.invoke("kie-ai", {
    body: { action: "credits" },
  });
  if (error) throw new Error(error.message);
  return data?.data ?? 0;
}

// Poll until task completes
export async function pollTask(
  taskId: string,
  onProgress?: (state: string, progress?: number) => void,
  maxAttempts = 120,
  intervalMs = 3000
): Promise<TaskResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getTaskStatus(taskId);
    onProgress?.(result.state || "waiting", result.progress);

    if (result.state === "success") return result;
    if (result.state === "fail") throw new Error(result.failMsg || "Task failed");

    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Task timed out");
}
