/**
 * Reference Video Prompt Compiler
 *
 * Compiles the raw user-edited prompt into a clean plain-text prompt
 * for Grok's reference-guided video generation.
 *
 * Key difference from previous storyboard compiler:
 * - Tags are INLINE within sentences, not forced to line starts
 * - The compiler preserves exact tag positions in the text
 * - It only normalizes whitespace and validates tag references
 * - No reordering of tags — they stay where the user placed them
 */

export interface CompileResult {
  success: true;
  compiledPrompt: string;
}

export interface CompileError {
  success: false;
  error: string;
}

export function compileStoryboardPrompt(
  rawPrompt: string,
  imageCount: number
): CompileResult | CompileError {
  if (!rawPrompt.trim()) {
    return { success: false, error: "يجب كتابة وصف للفيديو المرجعي" };
  }
  if (imageCount < 1) {
    return { success: false, error: "يجب إضافة صورة مرجعية واحدة على الأقل" };
  }
  if (imageCount > 7) {
    return { success: false, error: "الحد الأقصى 7 صور مرجعية" };
  }

  // ── Step 1: Normalize whitespace ──
  let text = rawPrompt
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Collapse multiple spaces into one (but keep newlines)
    .replace(/[^\S\n]+/g, " ")
    .trim();

  // ── Step 2: Validate tags ──
  const tagMatches = [...text.matchAll(/@image(\d+)/g)];

  for (const match of tagMatches) {
    const num = parseInt(match[1]);
    if (num < 1 || num > imageCount) {
      return {
        success: false,
        error: `الوصف يشير إلى @image${num} لكن لديك ${imageCount} صور فقط`,
      };
    }
  }

  return { success: true, compiledPrompt: text };
}

/**
 * Validates that a reference video prompt is structurally sound.
 * Used for real-time UI validation.
 */
export function validateStoryboardPrompt(
  rawPrompt: string,
  imageCount: number
): { valid: boolean; error?: string } {
  if (!rawPrompt.trim()) {
    return { valid: false, error: "يجب كتابة وصف للفيديو" };
  }

  const text = rawPrompt.replace(/\u00A0/g, " ");
  const tagMatches = [...text.matchAll(/@image(\d+)/g)];

  for (const match of tagMatches) {
    const num = parseInt(match[1]);
    if (num < 1 || num > imageCount) {
      return {
        valid: false,
        error: `@image${num} غير صالح — لديك ${imageCount} صور فقط`,
      };
    }
  }

  return { valid: true };
}
