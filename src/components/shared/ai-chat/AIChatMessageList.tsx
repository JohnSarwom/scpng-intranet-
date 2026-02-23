import React from 'react';
import { Loader2, ClipboardCopy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { AIChatMessage } from './types';

interface AIChatMessageListProps {
    messages: AIChatMessage[];
    isSending: boolean;
    copiedMessageId: string | null;
    onCopy: (id: string, text: string) => void;
    onFollowUpClick: (question: string) => void;
    messagesContainerRef: React.RefObject<HTMLDivElement>;
    /** Shows the logo + disclaimer placeholder when true (initial/empty state) */
    showPlaceholder: boolean;
    placeholderDisclaimer?: string;
}

const AIChatMessageList: React.FC<AIChatMessageListProps> = ({
    messages,
    isSending,
    copiedMessageId,
    onCopy,
    onFollowUpClick,
    messagesContainerRef,
    showPlaceholder,
    placeholderDisclaimer = 'This assistant provides AI-calculated insights. Always verify information against official sources.',
}) => {
    const lastMessage = messages[messages.length - 1];
    const isAiTyping = lastMessage?.sender === 'ai' && lastMessage?.isTyping;

    return (
        <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto mb-4 custom-scrollbar bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4"
        >
            {showPlaceholder ? (
                <div className="flex flex-col items-center justify-center h-full">
                    <img
                        src="/images/SCPNG Original Logo.png"
                        alt="SCPNG Logo"
                        className="w-24 h-24 mb-4"
                    />
                    <h2 className="font-semibold text-gray-600 dark:text-gray-300 mb-2 text-lg">
                        What can I help with?
                    </h2>
                    <div className="max-w-md text-center px-4 py-3 rounded-lg border border-amber-200 bg-amber-50/50 text-amber-800 text-xs shadow-sm backdrop-blur-sm animate-in fade-in duration-700 mt-2">
                        <p className="leading-relaxed">
                            <span className="font-bold uppercase tracking-wider block mb-1">AI Disclaimer</span>
                            {placeholderDisclaimer}
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {messages.map((message) => (
                        <React.Fragment key={message.id}>
                            <div
                                className={cn(
                                    'mb-3 flex',
                                    message.sender === 'user' ? 'justify-end' : 'justify-start'
                                )}
                            >
                                <div
                                    className={cn(
                                        'inline-block rounded-lg p-3 max-w-[80%] break-words relative group',
                                        message.sender === 'user'
                                            ? 'bg-intranet-primary text-white'
                                            : 'bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                                    )}
                                >
                                    {message.sender === 'ai' ? (
                                        <div className="prose prose-sm max-w-none dark:prose-invert">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ node, ...props }) => {
                                                        const children = React.Children.toArray(props.children);
                                                        const firstChild = children[0];
                                                        let additionalClasses = '';
                                                        if (typeof firstChild === 'string') {
                                                            const trimmed = firstChild.trim();
                                                            if (/^\(\d+\)/.test(trimmed)) {
                                                                additionalClasses = 'ml-4 pl-2 border-l border-transparent';
                                                            } else if (/^\([a-z]\)/.test(trimmed)) {
                                                                additionalClasses = 'ml-8 pl-2 border-l border-transparent';
                                                            }
                                                        }
                                                        return <p className={cn('mb-2 last:mb-0', additionalClasses)} {...props} />;
                                                    },
                                                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2" {...props} />,
                                                    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2" {...props} />,
                                                    li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                                    blockquote: ({ node, ...props }) => {
                                                        const children = React.Children.toArray(props.children);
                                                        let isNote = false;

                                                        const stripNote = (child: any): any => {
                                                            if (typeof child === 'string') {
                                                                if (child.includes('[!NOTE]')) {
                                                                    isNote = true;
                                                                    return child.replace('[!NOTE]', '').trim();
                                                                }
                                                                return child;
                                                            }
                                                            if (React.isValidElement(child)) {
                                                                const childProps = child.props as any;
                                                                if (childProps.children) {
                                                                    return React.cloneElement(child, {
                                                                        ...childProps,
                                                                        children: React.Children.map(childProps.children, stripNote),
                                                                    });
                                                                }
                                                            }
                                                            return child;
                                                        };

                                                        const newChildren = children.map(stripNote);
                                                        return (
                                                            <blockquote
                                                                className={cn(
                                                                    'border-l-4 pl-4 py-2 my-4 italic rounded-r-md whitespace-pre-wrap',
                                                                    isNote
                                                                        ? 'bg-blue-50/50 border-blue-500 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100 dark:border-blue-400 font-medium'
                                                                        : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50'
                                                                )}
                                                                {...props}
                                                            >
                                                                {newChildren}
                                                            </blockquote>
                                                        );
                                                    },
                                                }}
                                            >
                                                {message.text}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        message.text
                                    )}

                                    {/* Typing cursor */}
                                    {message.sender === 'ai' && message.isTyping && (
                                        <span className="ai-cursor" />
                                    )}

                                    {/* Copy button — hover reveal */}
                                    {message.sender === 'ai' && !message.isTyping && message.text && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-300/50 hover:bg-gray-400/70 dark:bg-gray-600/50 dark:hover:bg-gray-500/70 p-1 rounded-full"
                                            onClick={() => onCopy(message.id, message.fullText || message.text)}
                                            title="Copy response"
                                        >
                                            {copiedMessageId === message.id
                                                ? <Check size={14} className="text-green-600" />
                                                : <ClipboardCopy size={14} className="text-gray-600 dark:text-gray-300" />
                                            }
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Follow-up question chips */}
                            {message.sender === 'ai' && !message.isTyping && message.followUpQuestions && message.followUpQuestions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-500 px-1">
                                    {message.followUpQuestions.map((question, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => onFollowUpClick(question)}
                                            className="text-xs transition-all duration-200 border border-intranet-primary/30 text-intranet-primary hover:bg-intranet-primary hover:text-white px-3 py-1.5 rounded-full bg-white/50 backdrop-blur-sm shadow-sm"
                                        >
                                            {question}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </React.Fragment>
                    ))}

                    {/* Loading spinner while waiting for AI */}
                    {isSending && lastMessage?.sender === 'user' && (
                        <div className="flex justify-start">
                            <div className="max-w-xs lg:max-w-md px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AIChatMessageList;
