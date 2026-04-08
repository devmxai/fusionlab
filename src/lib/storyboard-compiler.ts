/**
 * Storyboard Prompt Compiler
 *
 * Compiles the raw user-edited storyboard prompt into a clean,
 * structured prompt that Grok can interpret reliably.
 *
 * Rules:
 * - Each referenced scene starts with @imageN at the beginning of a line
 * - Line order must match image order (no skipped or out-of-order tags)
 * - Non-breaking spaces replaced with normal ASCII spaces
 * - Whitespace normalized
 * - A general direction footer is appended for scene coherence
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
    return { success: false, error: "يجب كتابة وصف للمشاهد في الستوري بورد" };
  }
  if (imageCount < 2) {
    return { success: false, error: "الستوري بورد يتطلب صورتين على الأقل" };
  }
  if (imageCount > 7) {
    return { success: false, error: "الحد الأقصى 7 صور في الستوري بورد" };
  }

  // ── Step 1: Normalize whitespace ──
  let text = rawPrompt
    // Replace all non-breaking spaces (U+00A0) with normal spaces
    .replace(/\u00A0/g, " ")
    // Replace zero-width spaces, word joiners, etc.
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "")
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // ── Step 2: Parse lines and extract scene descriptions ──
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // Extract all @imageN references and their descriptions
  const scenes: { tag: number; description: string }[] = [];
  let generalText = "";

  for (const line of lines) {
    const match = line.match(/^@image(\d+)\s*(.*)/);
    if (match) {
      const tagNum = parseInt(match[1]);
      const desc = match[2].trim();
      scenes.push({ tag: tagNum, description: desc });
    } else {
      // Line without @imageN tag — treat as general direction
      generalText += (generalText ? " " : "") + line;
    }
  }

  // ── Step 3: Validate tags ──
  // Check for invalid tag numbers
  for (const scene of scenes) {
    if (scene.tag < 1 || scene.tag > imageCount) {
      return {
        success: false,
        error: `الوصف يشير إلى @image${scene.tag} لكن لديك ${imageCount} صور فقط`,
      };
    }
  }

  // Check for duplicate tags
  const tagSet = new Set<number>();
  for (const scene of scenes) {
    if (tagSet.has(scene.tag)) {
      return {
        success: false,
        error: `يوجد تكرار في الإشارة إلى @image${scene.tag}`,
      };
    }
    tagSet.add(scene.tag);
  }

  // Sort scenes by tag number to ensure correct order
  scenes.sort((a, b) => a.tag - b.tag);

  // ── Step 4: Build compiled prompt ──
  const compiledLines: string[] = [];

  for (const scene of scenes) {
    const desc = scene.description || `scene ${scene.tag}`;
    compiledLines.push(`@image${scene.tag} ${desc}`);
  }

  // Add general direction footer for scene coherence
  const footer =
    generalText ||
    "General direction: smooth cinematic transition between scenes, preserve identity consistency, do not merge references unless explicitly requested, avoid blending unrelated references in the same frame.";

  compiledLines.push(footer);

  const compiledPrompt = compiledLines.join("\n");

  return { success: true, compiledPrompt };
}

/**
 * Validates that a storyboard prompt is structurally sound
 * without compiling it. Used for real-time UI validation.
 */
export function validateStoryboardPrompt(
  rawPrompt: string,
  imageCount: number
): { valid: boolean; error?: string } {
  if (!rawPrompt.trim()) {
    return { valid: false, error: "يجب كتابة وصف للمشاهد" };
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
