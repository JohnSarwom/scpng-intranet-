/**
 * Chat with the AI to create or change a workflow.
 *
 * Uses the app's existing AI configuration (Admin > API & Integrations: the
 * preferred provider and model, keys, and the secure gateway) through
 * useAiService, under the gateway's existing "strategy" feature. A valid reply
 * becomes an unsaved draft on the canvas; nothing is saved from here.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AIChatPanel, type AIChatMessage } from '@/components/shared/ai-chat';
import { AiProviderStatus } from '@/components/ai/AiProviderStatus';
import { useAiService } from '@/hooks/useAiService';
import { useAiConversationLifecycle } from '@/hooks/useAiConversationLifecycle';
import { readAiRoute } from '@/services/aiService';
import { parseAiWorkflow } from '@/workflows/workflowSchema';
import type { WorkflowDefinition } from '@/workflows/workflowTypes';
import {
  WORKFLOW_BUILDER_SYSTEM_PROMPT,
  buildWorkflowRequest,
  stripWorkflowBlocks,
} from '@/prompts/workflowBuilderPrompt';

interface WorkflowAIBuilderProps {
  /** The workflow on the canvas; refinements edit it (a built-in one is used as a starting point). */
  current: WorkflowDefinition | null;
  /** Called with each valid workflow the AI returns. */
  onDraft: (definition: WorkflowDefinition) => void;
}

const GREETING: AIChatMessage = {
  id: 'greeting',
  sender: 'ai',
  text: 'Describe a workflow and I will draft it on the canvas. You can then ask for changes, run it, and save it.',
  timestamp: new Date(),
};

const STARTERS = [
  'Draft a leave application approval workflow',
  'Draft an IT support ticket workflow with escalation',
  'Draft a licence application review with a return-for-revision step',
];

export default function WorkflowAIBuilder({ current, onDraft }: WorkflowAIBuilderProps) {
  const aiService = useAiService('strategy');
  const [messages, setMessages] = useState<AIChatMessage[]>([GREETING]);
  const [query, setQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /**
   * Whether requests build on the workflow on the canvas. On for drafts and
   * saved workflows; off for built-in ones, so "draft a new workflow" starts fresh.
   */
  const [useCurrent, setUseCurrent] = useState(false);
  const currentKey = current ? `${current.source}:${current.id}` : '';
  useEffect(() => { setUseCurrent(!!current && current.source !== 'built-in'); }, [currentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useAiConversationLifecycle({
    sourceId: 'workflow-builder',
    controller: abortRef,
    setMessages,
    setQuery,
    setBusy: setIsSending,
    clearRoute: aiService.clearRoute,
  });

  const addAiMessage = (message: Omit<AIChatMessage, 'id' | 'sender' | 'timestamp'>) =>
    setMessages(previous => [...previous, { id: uuidv4(), sender: 'ai', timestamp: new Date(), isTyping: false, ...message }]);

  const scrollToEnd = () => setTimeout(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, 50);

  const send = useCallback(async (text: string, fresh = false) => {
    const request = text.trim();
    if (!request || isSending) return;
    const base = fresh || !useCurrent ? null : current;
    setQuery('');
    const history = messages;
    setMessages(previous => [...previous, { id: uuidv4(), sender: 'user', text: request, timestamp: new Date() }]);
    scrollToEnd();

    if (!aiService.isReady) {
      addAiMessage({ text: 'The AI connection is still loading. Try again in a moment.' });
      return;
    }
    if (!aiService.isConfigured) {
      addAiMessage({ text: 'AI is not configured. An administrator can set it up in Admin > API & Integrations.' });
      return;
    }

    setIsSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Older workflow JSON is dropped to stay within the request limit; the
      // latest reply keeps it so "fix these problems" can see what to fix.
      const earlier = history.filter(message => message.id !== GREETING.id && !message.isTyping);
      const lastAiIndex = earlier.map(message => message.sender).lastIndexOf('ai');
      const contents = [
        ...earlier.map((message, index) => ({
          role: message.sender === 'user' ? 'user' : 'model',
          parts: [{
            text: message.sender === 'ai'
              ? (index === lastAiIndex ? message.fullText || message.text : stripWorkflowBlocks(message.fullText || message.text))
              : message.text,
          }],
        })),
        { role: 'user', parts: [{ text: buildWorkflowRequest(request, base) }] },
      ];
      const response = await aiService.generateContent({
        body: {
          system_instruction: { parts: [{ text: WORKFLOW_BUILDER_SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
        },
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted || abortRef.current !== controller) return;
      if (!response.ok) throw new Error(data?.error?.message || 'The AI service could not answer this request.');

      const reply: string = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '';
      if (!reply.trim()) throw new Error('The AI returned an empty answer.');

      const keepId = base && base.source !== 'built-in' ? base.id : undefined;
      const parsed = parseAiWorkflow(reply, { keepId });
      const route = readAiRoute(response);

      if (parsed.definition) {
        onDraft(parsed.definition);
        addAiMessage({
          text: `${parsed.message || 'Here is the workflow.'}\n\n**Draft on the canvas:** ${parsed.definition.title} (${parsed.definition.nodes.length} steps). It is not saved yet.`,
          fullText: reply,
          route,
          sourceLabel: 'Workflow builder',
          followUpQuestions: ['Add an approval step before the end', 'Add a return-for-revision loop', 'Explain each step'],
        });
      } else if (/did not include a workflow/.test(parsed.errors[0] || '')) {
        // The AI asked a question or explained instead of drafting.
        addAiMessage({ text: parsed.message || reply, fullText: reply, route, sourceLabel: 'Workflow builder' });
      } else {
        addAiMessage({
          text: `${parsed.message ? `${parsed.message}\n\n` : ''}The workflow it sent can't be drawn yet:\n\n${parsed.errors.map(error => `- ${error}`).join('\n')}`,
          fullText: reply,
          route,
          sourceLabel: 'Workflow builder',
          followUpQuestions: [`Fix these problems and send the complete workflow again: ${parsed.errors.slice(0, 6).join(' ')}`],
        });
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      addAiMessage({ text: error?.message || 'The AI request failed.' });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsSending(false);
      scrollToEnd();
    }
  }, [aiService, current, useCurrent, isSending, messages, onDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void send(query);
  };

  const onCopy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const header = (
    <div className="space-y-2 p-3">
      <AiProviderStatus preferredProvider={aiService.settings.provider} lastRoute={aiService.lastRoute} />
      {current && (
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 accent-[#83002A]"
            checked={useCurrent}
            onChange={event => setUseCurrent(event.target.checked)}
          />
          <span>
            {current.source === 'built-in'
              ? <>Start from <strong>{current.title}</strong> (makes a new draft; the built-in one is not changed)</>
              : <>Change <strong>{current.title}</strong> (otherwise a new workflow is drafted)</>}
          </span>
        </label>
      )}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-1.5">
          {STARTERS.map(starter => (
            <button
              key={starter}
              type="button"
              onClick={() => void send(starter, true)}
              disabled={isSending}
              className="rounded-full border border-intranet-primary/30 bg-white px-2.5 py-1 text-[11px] text-intranet-primary transition-colors hover:bg-intranet-primary hover:text-white disabled:opacity-50 dark:bg-gray-900 dark:text-rose-300"
            >
              {starter}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <AIChatPanel
      ref={scrollRef}
      messages={messages}
      isSending={isSending}
      query={query}
      onQueryChange={setQuery}
      onSubmit={onSubmit}
      copiedMessageId={copiedMessageId}
      onCopy={onCopy}
      onFollowUpClick={question => void send(question)}
      disabled={isSending}
      inputPlaceholder="Describe a workflow, or ask for a change…"
      placeholderDisclaimer="Workflows drafted by AI are suggestions. Review every step before saving or publishing."
      headerSlot={header}
      className="min-h-0"
    />
  );
}
