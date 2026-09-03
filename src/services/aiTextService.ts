/**
 * aiTextService
 *
 * Thin wrapper around the Gemini generateContent endpoint for rewriting a
 * single piece of user-typed text (task titles, descriptions, comments...).
 * Deliberately stateless: the caller supplies the API key (see
 * useGeminiApiKey) and an optional AbortSignal.
 */

export type ImproveMode = 'grammar' | 'polish' | 'title' | 'expand';

export interface ImproveOptions {
  mode: ImproveMode;
  /** Short label for the field, e.g. "task title" or "comment on a task". */
  context?: string;
  apiKey: string;
  signal?: AbortSignal;
  model?: string;
}

export interface ImproveResult {
  /** Up to IMPROVE_VARIANT_COUNT distinct suggestions, best first. Empty when nothing differed. */
  variants: string[];
  /** True when every suggestion matched the input, so there is nothing to apply. */
  unchanged: boolean;
  /** True when the input was cut to MAX_INPUT_CHARS before sending. */
  truncated: boolean;
}

export class AiTextError extends Error {
  code: 'not-configured' | 'too-short' | 'rate-limited' | 'blocked' | 'empty' | 'network' | 'api';
  /** HTTP status from the Gemini API, when the error came from a response. */
  status?: number;
  constructor(code: AiTextError['code'], message: string, status?: number) {
    super(message);
    this.name = 'AiTextError';
    this.code = code;
    this.status = status;
  }
  /** True when the API rejected the key itself (invalid, revoked or not permitted). */
  get isKeyRejected(): boolean {
    return this.status === 400 || this.status === 401 || this.status === 403;
  }
}

// gemini-2.5-flash-lite is closed to new API keys (404 "no longer available to new users").
export const DEFAULT_IMPROVE_MODEL = 'gemini-3.5-flash-lite';
export const MIN_INPUT_CHARS = 3;
export const MAX_INPUT_CHARS = 4000;
/** How many alternatives to ask the model for. */
export const IMPROVE_VARIANT_COUNT = 3;

/** Separator the model is told to put between alternatives. Unlikely to appear in prose. */
const VARIANT_SEPARATOR = '%%%';

export const IMPROVE_MODE_LABELS: Record<ImproveMode, string> = {
  grammar: 'Fix grammar',
  polish: 'Polish wording',
  title: 'Make it a clear title',
  expand: 'Expand into a description',
};

const COMMON_RULES = `You rewrite text typed into an internal staff intranet form.

Output format:
- Give exactly ${IMPROVE_VARIANT_COUNT} alternative rewrites of the SAME text.
- Separate them with a line containing only ${VARIANT_SEPARATOR}
- Output nothing else: no preamble, no numbering, no bullet points, no quotes, no markdown, no explanations, no labels.

Rules that always apply to every alternative:
- Make the alternatives meaningfully different from each other in wording or structure, never trivial variations of punctuation.
- Preserve the meaning exactly. Never add facts, names, dates, numbers or tasks that are not in the original.
- Keep the original language. If the text is in Tok Pisin, keep it in Tok Pisin. Do not translate.
- Keep proper nouns, acronyms and system names exactly as written (for example SCPNG, KRA, KPI, IPA, SharePoint, Azure).
- Keep the original line structure. If the text is written as several lines or bullet points, return the same number of lines, one point per line. Never merge separate lines into a paragraph.
- Every alternative must be usable on its own as a complete replacement for the original text.`;

const MODE_RULES: Record<ImproveMode, string> = {
  grammar: `Task: fix spelling, grammar, capitalisation and punctuation. Keep the writer's wording, tone and length.
The first alternative must be the minimal correction, changing only what is actually wrong. The others may also tidy word order or word choice slightly, while staying faithful to how the writer put it.`,
  polish: `Task: fix grammar and make the wording clearer and professional. Keep roughly the same length and keep every point the writer made. Do not add new content.
Let the alternatives differ in register and structure: one close to the original, one more concise and direct, one more formal.`,
  title: `Task: turn the text into a clear title. Each alternative is one line, sentence case, at most 12 words, no trailing period, no quotes, keeping the key subject and action.
Let the alternatives differ in emphasis: one action-first, one subject-first, one shorter.`,
  expand: `Task: expand the note into two to four complete sentences that a colleague could act on. Use only information present in the note; do not invent details, owners, or deadlines.
Let the alternatives differ in structure: one flowing prose, one that states the situation then the action needed, one more brief.`,
};

const buildSystemInstruction = (mode: ImproveMode, context?: string): string => {
  const ctx = context ? `The text is a ${context}.` : '';
  return [COMMON_RULES, ctx, MODE_RULES[mode]].filter(Boolean).join('\n\n');
};

/** Strip wrappers the model sometimes adds despite instructions. */
const cleanModelText = (raw: string): string => {
  let t = raw.trim();
  // Leading labels such as "Improved:" / "Here is the improved text:"
  t = t.replace(/^(here('s| is)( the| your)?( improved| rewritten| corrected| polished)?( text| title| version)?\s*:\s*)/i, '');
  t = t.replace(/^(improved|rewritten|corrected|polished|title|result)\s*:\s*/i, '');
  // Fenced code blocks
  t = t.replace(/^```[a-z]*\n?([\s\S]*?)\n?```$/i, '$1').trim();
  // Leading list markers the model adds when it numbers its alternatives anyway
  t = t.replace(/^(?:\d+[.)]|[-*•])\s+/, '').trim();
  // "Option 2:" / "Alternative 3 -" style prefixes
  t = t.replace(/^(option|alternative|version|variant)\s*\d*\s*[:.\-–]\s*/i, '').trim();
  // Surrounding quotes
  if (t.length > 1 && /^["'“”‘’]/.test(t) && /["'“”‘’]$/.test(t)) {
    t = t.slice(1, -1).trim();
  }
  return t;
};

/**
 * Split the model's reply into distinct suggestions.
 * Falls back to treating the whole reply as one suggestion when the model
 * ignores the separator.
 */
const parseVariants = (raw: string, original: string): string[] => {
  const pieces = raw.split(new RegExp(`^[ \\t]*${VARIANT_SEPARATOR}[ \\t]*$`, 'm'));
  const seen = new Set<string>();
  const variants: string[] = [];

  for (const piece of pieces) {
    const cleaned = cleanModelText(piece);
    if (!cleaned) continue;
    const fingerprint = cleaned.toLowerCase();
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    if (cleaned === original) continue;
    variants.push(cleaned);
    if (variants.length >= IMPROVE_VARIANT_COUNT) break;
  }
  return variants;
};

export const improveText = async (input: string, options: ImproveOptions): Promise<ImproveResult> => {
  const { mode, context, apiKey, signal, model = DEFAULT_IMPROVE_MODEL } = options;

  if (!apiKey || !apiKey.trim()) {
    throw new AiTextError('not-configured', 'AI is not configured.');
  }

  const original = input.trim();
  if (original.length < MIN_INPUT_CHARS) {
    throw new AiTextError('too-short', 'Type a little more before improving.');
  }

  const truncated = original.length > MAX_INPUT_CHARS;
  const text = truncated ? original.slice(0, MAX_INPUT_CHARS) : original;

  const body = {
    system_instruction: { parts: [{ text: buildSystemInstruction(mode, context) }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      // A little heat so the alternatives actually differ; grammar stays tight.
      temperature: mode === 'grammar' ? 0.25 : 0.55,
      topP: 0.95,
      // Room for IMPROVE_VARIANT_COUNT alternatives plus separators.
      maxOutputTokens: mode === 'expand' ? 2048 : 1024,
    },
  };

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new AiTextError('network', 'Could not reach the AI service. Check your connection and try again.');
  }

  if (response.status === 429) {
    throw new AiTextError('rate-limited', 'AI is busy right now. Try again in a moment.', 429);
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData?.error?.message ? ` (${errorData.error.message})` : '';
    throw new AiTextError('api', `AI request failed with status ${response.status}${detail}.`, response.status);
  }

  const data = await response.json();

  if (data?.promptFeedback?.blockReason) {
    throw new AiTextError('blocked', 'AI could not improve this text.');
  }

  const parts: Array<{ text?: string }> | undefined = data?.candidates?.[0]?.content?.parts;
  const candidateText = parts?.map((p) => p?.text ?? '').join('');

  if (!candidateText || !candidateText.trim()) {
    throw new AiTextError('empty', 'AI returned nothing for this text.');
  }

  const variants = parseVariants(candidateText, original);

  return {
    variants,
    unchanged: variants.length === 0,
    truncated,
  };
};
