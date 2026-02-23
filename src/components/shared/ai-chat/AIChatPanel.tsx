import React from 'react';
import AIChatMessageList from './AIChatMessageList';
import AIChatInputBar from './AIChatInputBar';
import type { AIChatMessage } from './types';

interface AIChatPanelProps {
    messages: AIChatMessage[];
    isSending: boolean;
    query: string;
    onQueryChange: (val: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    copiedMessageId: string | null;
    onCopy: (id: string, text: string) => void;
    onFollowUpClick: (question: string) => void;
    disabled?: boolean;
    inputPlaceholder?: string;
    /** Disclaimer text shown in the initial placeholder state */
    placeholderDisclaimer?: string;
    /** Optional slot rendered above the messages area (e.g. status strip, quick chips) */
    headerSlot?: React.ReactNode;
    className?: string;
}

/**
 * Reusable AI chat panel that replicates the AIHub chat interface styling.
 * Renders: optional header slot → scrollable message list → input bar.
 * Use this wherever you need an AIHub-style chat UI.
 */
const AIChatPanel = React.forwardRef<HTMLDivElement, AIChatPanelProps>(
    (
        {
            messages,
            isSending,
            query,
            onQueryChange,
            onSubmit,
            copiedMessageId,
            onCopy,
            onFollowUpClick,
            disabled,
            inputPlaceholder,
            placeholderDisclaimer,
            headerSlot,
            className,
        },
        scrollRef
    ) => {
        const isAiTyping =
            messages.length > 0 &&
            messages[messages.length - 1].sender === 'ai' &&
            !!messages[messages.length - 1].isTyping;

        // Show placeholder logo/disclaimer when only the initial AI greeting exists
        const showPlaceholder =
            messages.length === 1 &&
            messages[0].sender === 'ai' &&
            !messages[0].isTyping;

        return (
            <div className={`flex flex-col h-full ${className ?? ''}`}>
                {headerSlot && (
                    <div className="shrink-0 border-b border-border">
                        {headerSlot}
                    </div>
                )}

                <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
                    <AIChatMessageList
                        messages={messages}
                        isSending={isSending}
                        copiedMessageId={copiedMessageId}
                        onCopy={onCopy}
                        onFollowUpClick={onFollowUpClick}
                        messagesContainerRef={scrollRef as React.RefObject<HTMLDivElement>}
                        showPlaceholder={showPlaceholder}
                        placeholderDisclaimer={placeholderDisclaimer}
                    />

                    <AIChatInputBar
                        query={query}
                        onQueryChange={onQueryChange}
                        onSubmit={onSubmit}
                        isSending={isSending}
                        isAiTyping={isAiTyping}
                        disabled={disabled}
                        placeholder={inputPlaceholder}
                    />
                </div>
            </div>
        );
    }
);

AIChatPanel.displayName = 'AIChatPanel';

export default AIChatPanel;
