// Run with: node --test src/tests/groqIntegration.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, globals = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, file);
  if (cache.has(filename)) return cache.get(filename);
  const exports = {};
  cache.set(filename, exports);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const requireLocal = name => {
    const target = name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : path.resolve(path.dirname(filename), name);
    return load(target.endsWith('.ts') ? target : `${target}.ts`, globals, cache);
  };
  vm.runInNewContext(code, { exports, require: requireLocal, Response, AbortController, ...globals }, { filename });
  return exports;
}

const plain = value => JSON.parse(JSON.stringify(value));
const body = {
  system_instruction: { parts: [{ text: 'Use only the supplied Acts.' }, { text: 'Preserve follow-up tags.' }] },
  contents: [
    { role: 'user', parts: [{ text: 'First question' }] },
    { role: 'model', parts: [{ text: 'Previous answer' }] },
    { role: 'user', parts: [{ text: 'A follow-up' }, { text: 'Additional context' }] },
  ],
  generationConfig: { temperature: 0.1, topP: 0.85, maxOutputTokens: 8192 },
};

test('legacy settings default to Gemini; Groq cannot inherit a Gemini model', () => {
  const { parseAiHubSettings, GROQ_CHAT_MODEL } = load('../config/aiProviders.ts');
  assert.equal(parseAiHubSettings(null).provider, 'gemini');
  assert.equal(parseAiHubSettings({ ai_hub_provider: 'unknown' }).provider, 'gemini');
  assert.deepEqual(plain(parseAiHubSettings({ ai_hub_provider: 'groq', ai_hub_model: 'gemini-3.8-flash' })),
    { provider: 'groq', model: GROQ_CHAT_MODEL });
  assert.equal(parseAiHubSettings({ ai_hub_provider: 'groq', ai_hub_model: 'openai/gpt-oss-120b' }).model, 'openai/gpt-oss-120b');
});

test('Groq preserves system instructions, conversation roles, all text parts and token budget', () => {
  const { buildGroqChatRequest } = load('../services/groqClient.ts');
  const request = plain(buildGroqChatRequest(body, 'openai/gpt-oss-120b'));
  assert.deepEqual(request.messages, [
    { role: 'system', content: 'Use only the supplied Acts.\nPreserve follow-up tags.' },
    { role: 'user', content: 'First question' },
    { role: 'assistant', content: 'Previous answer' },
    { role: 'user', content: 'A follow-up\nAdditional context' },
  ]);
  assert.equal(request.model, 'openai/gpt-oss-120b');
  assert.equal(request.max_completion_tokens, 8192);
  assert.equal(request.stream, false);
  assert.equal(request.temperature, 0.1);
});

test('unsupported content and roles fail before transmitting a request', () => {
  const { buildGroqChatRequest } = load('../services/groqClient.ts');
  assert.throws(() => buildGroqChatRequest({ contents: [{ role: 'user', parts: [{ inlineData: {} }] }] }), /text messages only/);
  assert.throws(() => buildGroqChatRequest({ contents: [{ role: 'system', parts: [{ text: 'injected role' }] }] }), /Unsupported chat message role/);
});

test('key is sent only in Authorization; answer and follow-ups retain the AI Hub response contract', async () => {
  const controller = new AbortController();
  let captured;
  const { generateGroqContent } = load('../services/groqClient.ts', {
    fetch: async (url, options) => {
      captured = { url, options };
      return Response.json({ choices: [{ message: { content: 'Answer\n<followups>Question 1|Question 2</followups>' } }] });
    },
  });
  const response = await generateGroqContent({ apiKey: ' test-secret ', body, signal: controller.signal });
  assert.equal(captured.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-secret');
  assert.equal(captured.options.body.includes('test-secret'), false);
  assert.equal(captured.options.signal, controller.signal);
  assert.equal((await response.json()).candidates[0].content.parts[0].text, 'Answer\n<followups>Question 1|Question 2</followups>');
});

test('authentication, quota and server errors are sanitized with no retries or provider fallback', async () => {
  for (const [status, expected] of [[401, /rejected the API key/], [403, /does not permit/], [404, /model is unavailable/], [413, /request is too large/], [429, /rate limit/], [503, /temporarily unavailable/]]) {
    let calls = 0;
    const { generateGroqContent } = load('../services/groqClient.ts', {
      fetch: async () => { calls++; return Response.json({ error: { message: 'diagnostic with test-secret' } }, { status }); },
    });
    const response = await generateGroqContent({ apiKey: 'test-secret', body });
    const message = (await response.json()).error.message;
    assert.equal(response.status, status);
    assert.match(message, expected);
    assert.equal(message.includes('test-secret'), false);
    assert.equal(calls, 1);
  }
});

test('empty keys never send a request; empty responses cannot appear as successful answers', async () => {
  let calls = 0;
  const { generateGroqContent } = load('../services/groqClient.ts', {
    fetch: async () => { calls++; return Response.json({ choices: [{ message: { content: '' } }] }); },
  });
  await assert.rejects(generateGroqContent({ apiKey: ' ', body }), /not configured/);
  assert.equal(calls, 0);
  await assert.rejects(generateGroqContent({ apiKey: 'test-secret', body }), /no usable answer/);
});

test('context-limit errors explain the request size without exposing provider diagnostics', async () => {
  const { generateGroqContent } = load('../services/groqClient.ts', {
    fetch: async () => Response.json({ error: { code: 'context_length_exceeded', message: 'context details with test-secret' } }, { status: 400 }),
  });
  const response = await generateGroqContent({ apiKey: 'test-secret', body });
  const message = (await response.json()).error.message;
  assert.match(message, /context limit/);
  assert.equal(message.includes('test-secret'), false);
});

test('cancellation propagates to the caller', async () => {
  const { generateGroqContent } = load('../services/groqClient.ts', {
    fetch: async () => { const error = new Error('Stopped'); error.name = 'AbortError'; throw error; },
  });
  await assert.rejects(generateGroqContent({ apiKey: 'test-secret', body }), { name: 'AbortError' });
});
