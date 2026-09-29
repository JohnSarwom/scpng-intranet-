import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useGeminiApiKey } from '@/hooks/useGeminiApiKey';
import { useAiTextAssistSettings } from '@/hooks/useAiTextAssistSettings';
import {
  improveText,
  AiTextError,
  IMPROVE_MODE_LABELS,
  MIN_INPUT_CHARS,
  type ImproveMode,
  type ImproveResult,
} from '@/services/aiTextService';

export interface AiImproveButtonProps {
  /** Current text of the field. */
  value: string;
  /** Called with the improved text when the user clicks Apply (and again on Undo). */
  onApply: (next: string) => void;
  /** One mode fires immediately; several modes show a small menu first. */
  mode: ImproveMode | ImproveMode[];
  /** Short label sent to the model, e.g. "task title". */
  context?: string;
  disabled?: boolean;
  /** Position the button in the top-right corner of a `relative` wrapper. */
  floating?: boolean;
  className?: string;
  /** Portal container for the popover (pass the dialog's container if any). */
  container?: HTMLElement | null;
}

/**
 * Config accepted by the `aiAssist` prop on the shared Input and Textarea.
 * The field supplies `value`, `disabled` and floating placement itself.
 */
export type AiAssistConfig = Pick<AiImproveButtonProps, 'mode' | 'onApply' | 'context' | 'container' | 'className'> & {
  /** Extra classes for the wrapper the field is placed in (e.g. `flex-1`). */
  wrapperClassName?: string;
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'choose' }
  | { kind: 'loading'; mode: ImproveMode }
  | { kind: 'result'; mode: ImproveMode; sent: string; result: ImproveResult }
  | { kind: 'error'; mode: ImproveMode; message: string };

/**
 * Sparkle button that sends a field's text to Gemini and offers the rewrite
 * back as a preview with Apply / Discard, plus an Undo toast after applying.
 * Renders nothing when no Gemini key is configured.
 */
export const AiImproveButton: React.FC<AiImproveButtonProps> = ({
  value,
  onApply,
  mode,
  context,
  disabled,
  floating,
  className,
  container,
}) => {
  const { apiKey, isConfigured, refresh: refreshApiKey } = useGeminiApiKey();
  const { settings } = useAiTextAssistSettings();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const modes = Array.isArray(mode) ? mode : [mode];
  const tooShort = value.trim().length < MIN_INPUT_CHARS;
  const isLoading = phase.kind === 'loading';

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Abort any in-flight request when the component unmounts (e.g. dialog closes).
  useEffect(() => cancel, [cancel]);

  const run = useCallback(
    async (selected: ImproveMode) => {
      if (!apiKey) return;
      cancel();
      const controller = new AbortController();
      abortRef.current = controller;
      const sent = value;
      setPhase({ kind: 'loading', mode: selected });
      try {
        const result = await improveText(sent, {
          mode: selected,
          context,
          apiKey,
          model: settings.model,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setPhase({ kind: 'result', mode: selected, sent, result });
      } catch (err: unknown) {
        if ((err instanceof Error && err.name === 'AbortError') || controller.signal.aborted) return;
        const message =
          err instanceof AiTextError ? err.message : 'Something went wrong while improving the text.';
        // A rejected key usually means it was rotated in SharePoint; re-read it for the next attempt.
        if (err instanceof AiTextError && err.isKeyRejected) void refreshApiKey();
        setPhase({ kind: 'error', mode: selected, message });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [apiKey, cancel, context, refreshApiKey, settings.model, value]
  );

  /**
   * Radix's trigger owns the open state, so the work is started here rather
   * than in an onClick, which would toggle the popover a second time.
   */
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      if (modes.length === 1) {
        void run(modes[0]);
      } else {
        setPhase({ kind: 'choose' });
      }
    } else {
      cancel();
      setPhase({ kind: 'idle' });
    }
  };

  const handleApply = (next: string) => {
    if (phase.kind !== 'result') return;
    const previous = value;
    onApply(next);
    handleOpenChange(false);
    toast({
      title: 'Text improved',
      description: phase.result.truncated
        ? 'Only the first 4,000 characters were sent to the AI service.'
        : undefined,
      action: (
        <ToastAction altText="Undo the AI change" onClick={() => onApply(previous)}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Undo
        </ToastAction>
      ),
    });
  };

  if (!isConfigured || !settings.enabled) return null;

  const edited = phase.kind === 'result' && phase.sent !== value;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          // Never disabled while the popover is open: disabling the trigger blurs
          // it, and the popover dismisses itself when focus leaves. Clicking
          // again cancels instead.
          disabled={(disabled || tooShort) && !open}
          title={
            tooShort
              ? 'Type a little more first'
              : isLoading
                ? 'Working. Click to cancel.'
                : 'Improve with AI. Text is sent to the AI service.'
          }
          aria-label="Improve with AI"
          className={cn(
            'h-7 w-7 rounded-md text-intranet-primary hover:bg-intranet-primary/10 dark:text-rose-300 dark:hover:bg-rose-300/10',
            floating && 'absolute right-1.5 top-1.5 z-10',
            className
          )}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        container={container ?? undefined}
        className="w-[min(30rem,calc(100vw-2rem))] p-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {phase.kind === 'choose' && (
          <div className="p-1">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Improve with AI</p>
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => void run(m)}
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                {IMPROVE_MODE_LABELS[m]}
              </button>
            ))}
          </div>
        )}

        {phase.kind === 'loading' && (
          <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {IMPROVE_MODE_LABELS[phase.mode]}…
          </div>
        )}

        {phase.kind === 'error' && (
          <div className="p-3 space-y-2">
            <p className="text-sm">{phase.message}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button type="button" size="sm" onClick={() => void run(phase.mode)}>
                Try again
              </Button>
            </div>
          </div>
        )}

        {phase.kind === 'result' && phase.result.unchanged && (
          <div className="p-3 space-y-2">
            <p className="text-sm">Looks good already. No changes suggested.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => void run(phase.mode)}>
                Try again
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}

        {phase.kind === 'result' && !phase.result.unchanged && (
          <div>
            <div className="border-b px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">You wrote</p>
              <p className="max-h-16 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">{phase.sent}</p>
            </div>

            <div className="px-3 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-intranet-primary dark:text-rose-300">
                {IMPROVE_MODE_LABELS[phase.mode]} &middot; pick one
              </p>
            </div>
            <div className="flex flex-col gap-1.5 p-2">
              {phase.result.variants.map((variant, i) => (
                <button
                  key={`${i}-${variant.slice(0, 24)}`}
                  type="button"
                  onClick={() => handleApply(variant)}
                  className="group flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:border-intranet-primary hover:bg-intranet-primary/5 focus-visible:border-intranet-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-intranet-primary dark:hover:border-rose-300 dark:hover:bg-rose-300/10"
                >
                  <span className="max-h-32 flex-1 overflow-y-auto whitespace-pre-wrap text-sm">{variant}</span>
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                </button>
              ))}
            </div>

            {edited && (
              <p className="border-t px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                You edited the text after these were generated. Choosing one will replace your edits.
              </p>
            )}
            <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-3 py-2">
              {modes.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mr-auto"
                  onClick={() => setPhase({ kind: 'choose' })}
                >
                  Other options
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={() => void run(phase.mode)}>
                Regenerate
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => handleOpenChange(false)}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default AiImproveButton;
