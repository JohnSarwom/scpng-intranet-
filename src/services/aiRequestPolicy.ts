import type { AiContentBody } from './groqClient.ts';

export const AI_INPUT_CHAR_BUDGET = 32000;
/** Keep the full system/evidence and current question; drop only whole older exchanges. */
export function prepareAiRequest(body: AiContentBody): AiContentBody {
  if (!body || !Array.isArray(body.contents) || !body.contents.length) throw new Error('Add a question before sending.');
  const last = body.contents[body.contents.length - 1];
  if (last.role !== 'user') throw new Error('The current AI request must end with a user question.');
  const valid = (parts: { text?: string }[]) => Array.isArray(parts) && parts.every(part => typeof part.text === 'string');
  if (!body.contents.every(item => ['user', 'model'].includes(item.role) && valid(item.parts)) || (body.system_instruction && !valid(body.system_instruction.parts))) throw new Error('This assistant supports text questions only.');
  const size = (value: unknown) => JSON.stringify(value).length;
  let used = size(body.system_instruction ?? {}) + size(last) + 200;
  if (used > AI_INPUT_CHAR_BUDGET) throw new Error('The question and its required evidence exceed the safe request limit. Select a narrower evidence filter or ask a shorter question. No source evidence was removed.');
  const contents = [last];
  for (let index = body.contents.length - 3; index >= 0 && contents.length < 7; index -= 2) {
    const pair = body.contents.slice(index, index + 2);
    if (pair[0]?.role !== 'user' || pair[1]?.role !== 'model') break;
    const length = size(pair);
    if (used + length > AI_INPUT_CHAR_BUDGET) break;
    contents.unshift(...pair);
    used += length;
  }
  return contents.length === body.contents.length ? body : { ...body, contents };
}
