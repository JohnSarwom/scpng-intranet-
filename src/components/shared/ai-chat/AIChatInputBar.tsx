import React from 'react';
import { Send, Square } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AIChatInputBarProps {
    query: string;
    onQueryChange: (val: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isSending: boolean;
    isAiTyping: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

const AIChatInputBar: React.FC<AIChatInputBarProps> = ({
    query,
    onQueryChange,
    onSubmit,
    isSending,
    isAiTyping,
    disabled,
    placeholder = 'Type your question...',
    className,
}) => {
    return (
        <form
            onSubmit={onSubmit}
            className={cn('flex gap-2 items-center', className)}
        >
            <Input
                placeholder={placeholder}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className="flex-1"
                disabled={(isSending || isAiTyping) || disabled}
            />
            <Button
                type="submit"
                className={cn(
                    isSending || isAiTyping
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-intranet-primary hover:bg-intranet-secondary'
                )}
                disabled={(!query.trim() && !isSending && !isAiTyping) || disabled}
            >
                {isSending || isAiTyping
                    ? <Square className="h-4 w-4 fill-current" />
                    : <Send size={18} />
                }
            </Button>
        </form>
    );
};

export default AIChatInputBar;
