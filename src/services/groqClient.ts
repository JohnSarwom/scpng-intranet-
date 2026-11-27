import { GROQ_CHAT_MODEL } from '../config/aiProviders.ts';

type TextPart = { text?: string };
export class GroqResponseError extends Error {
  constructor() { super('Groq returned no usable answer.'); this.name = 'GroqResponseError'; }
}
export interface AiContentBody {
  system_instruction?: { parts: TextPart[] };
  contents: { role: string; parts: TextPart[] }[];
  generationConfig?: { temperature?: number; topP?: number; maxOutputTokens?: number };
}

const textParts = (parts: TextPart[]) => parts.map(part => {
  if (typeof part.text !== 'string') throw new Error('Groq AI Hub currently supports text messages only.');
  return part.text;
}).join('\n');

/** Translate the AI Hub's text/history contract without losing its system prompt. */
export const buildGroqChatRequest = (body: AiContentBody, model = GROQ_CHAT_MODEL) => ({
  model,
  messages: [
    ...(body.system_instruction ? [{ role: 'system', content: textParts(body.system_instruction.parts) }] : []),
    ...body.contents.map(content => {
      if (content.role !== 'user' && content.role !== 'model') throw new Error('Unsupported chat message role.');
      return { role: content.role === 'model' ? 'assistant' : 'user', content: textParts(content.parts) };
    }),
  ],
  temperature: body.generationConfig?.temperature ?? 0.1,
  top_p: body.generationConfig?.topP ?? 0.85,
  max_completion_tokens: body.generationConfig?.maxOutputTokens ?? 8192,
  stream: false,
});

const errorMessage = (status: number) => {
  if (status === 401) return 'Groq rejected the API key. Update it in Admin > API & Integrations.';
  if (status === 403) return 'The Groq project does not permit this request or model.';
  if (status === 404) return 'This Groq model is unavailable. Select another model.';
  if (status === 413) return 'This Groq request is too large. Use General Purpose AI for a shorter prompt or check your account limits.';
  if (status === 429) return 'Groq rate limit reached. Wait a moment, or use General Purpose AI for a shorter request.';
  if (status >= 500) return 'Groq is temporarily unavailable. Try again shortly.';
  return 'Groq could not complete the request. Check the selected model and request size.';
};

export const generateGroqContent = async ({ apiKey, body, model = GROQ_CHAT_MODEL, signal }: {
  apiKey: string; body: AiContentBody; model?: string; signal?: AbortSignal;
}): Promise<Response> => {
  if (!apiKey.trim()) throw new Error('Groq is not configured. Add its API key in Admin > API & Integrations.');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify(buildGroqChatRequest(body, model)),
    signal,
  });
  // Do not surface raw upstream diagnostics that could contain credential information.
  if (!response.ok) {
    const diagnostic = await response.json().catch(() => null);
    const blocked = ['content_policy_violation', 'content_filter', 'moderation_blocked'].includes(String(diagnostic?.error?.code))
      || /content policy|prohibited content|safety policy/i.test(String(diagnostic?.error?.message ?? ''));
    const tooLong = diagnostic?.error?.code === 'context_length_exceeded'
      || /context.{0,30}(?:length|limit)|reduce.{0,40}(?:messages|tokens)|maximum context/i.test(String(diagnostic?.error?.message ?? ''));
    const invalidKey = diagnostic?.error?.code === 'invalid_api_key';
    const unavailableModel = ['model_not_found', 'model_decommissioned', 'model_not_available'].includes(String(diagnostic?.error?.code));
    return Response.json({ error: { code: blocked ? 'content_blocked' : tooLong ? 'context_length_exceeded' : invalidKey ? 'API_KEY_INVALID' : unavailableModel ? 'model_unavailable' : undefined, message: blocked
      ? 'Groq declined this request under its content policy.' : tooLong
      ? 'The Groq request exceeds the model context limit. Ask about fewer sections or shorten the conversation.'
      : errorMessage(response.status) } }, { status: response.status });
  }
  const data = await response.json();
  if (data?.choices?.[0]?.finish_reason === 'content_filter' || data?.choices?.[0]?.message?.refusal) {
    return Response.json({ error: { code: 'content_blocked', message: 'Groq declined this request under its content policy.' } }, { status: 422 });
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new GroqResponseError();
  }
  // Keep AI Hub response handling, follow-ups and typing animation provider-independent.
  return Response.json({ candidates: [{ finishReason: data?.choices?.[0]?.finish_reason === 'length' ? 'MAX_TOKENS' : 'STOP', content: { parts: [{ text }] } }] });
};
