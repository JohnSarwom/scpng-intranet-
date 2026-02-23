import React, { useState } from 'react';
import {
    Search,
    HelpCircle,
    ChevronRight,
    Zap,
    BookOpen,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

export interface StaticQuestion {
    id: string;
    text: string;
}

export interface StaticCategory {
    id: string;
    title: string;
    questions: StaticQuestion[];
}

interface StaticQuestionLibrarySidebarProps {
    categories: StaticCategory[];
    onSelectQuestion: (question: string) => void;
    title?: string;
    className?: string;
}

/**
 * Question library sidebar with the same styling as QuestionLibrarySidebar
 * but driven by static in-memory data instead of fetched text files.
 * Use wherever you need a question library panel with pre-defined categories.
 */
const StaticQuestionLibrarySidebar: React.FC<StaticQuestionLibrarySidebarProps> = ({
    categories,
    onSelectQuestion,
    title = 'Question Library',
    className,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [openCategoryId, setOpenCategoryId] = useState<string | undefined>(undefined);

    const filteredCategories = categories
        .map((cat) => ({
            ...cat,
            questions: cat.questions.filter(
                (q) =>
                    q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    cat.title.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        }))
        .filter((cat) => cat.questions.length > 0);

    return (
        <div className={`flex flex-col h-full ${className ?? ''}`}>
            {/* Sticky header */}
            <div className="p-4 border-b border-border space-y-3 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-intranet-primary" />
                    <h2 className="text-lg font-bold tracking-tight">{title}</h2>
                </div>

                <div className="relative group">
                    <Search
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-intranet-primary transition-colors"
                        size={14}
                    />
                    <Input
                        placeholder="Search questions..."
                        className="pl-8 h-9 text-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Scrollable categories */}
            <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
                {filteredCategories.length > 0 ? (
                    <Accordion
                        type="single"
                        collapsible
                        className="space-y-3"
                        value={openCategoryId}
                        onValueChange={setOpenCategoryId}
                    >
                        {filteredCategories.map((category) => (
                            <AccordionItem
                                key={category.id}
                                value={category.id}
                                className="border rounded-lg overflow-hidden border-border bg-card shadow-sm hover:border-intranet-primary/20 transition-all"
                            >
                                <AccordionTrigger className="px-3 py-3 hover:no-underline text-left">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] py-0 px-1.5 h-4 bg-primary/5 text-primary border-primary/20"
                                            >
                                                {category.questions.length}
                                            </Badge>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                                                Topic
                                            </span>
                                        </div>
                                        <h3
                                            className={`text-sm font-semibold text-foreground group-hover:text-intranet-primary ${
                                                openCategoryId === category.id
                                                    ? 'whitespace-normal'
                                                    : 'truncate'
                                            }`}
                                        >
                                            {category.title}
                                        </h3>
                                    </div>
                                </AccordionTrigger>

                                <AccordionContent className="bg-gray-50/50 dark:bg-gray-950/20">
                                    <div className="divide-y divide-border/50">
                                        {category.questions.map((q) => (
                                            <button
                                                key={q.id}
                                                onClick={() => onSelectQuestion(q.text)}
                                                className="w-full h-auto text-left py-3 px-3 hover:bg-white dark:hover:bg-gray-800 transition-colors flex items-start gap-3 group/item border-l-2 border-transparent hover:border-intranet-primary"
                                            >
                                                <Zap className="w-3.5 h-3.5 mt-0.5 text-muted-foreground group-hover/item:text-intranet-primary transition-colors flex-shrink-0" />
                                                <span className="text-xs leading-relaxed text-muted-foreground group-hover/item:text-foreground transition-colors">
                                                    {q.text}
                                                </span>
                                                <ChevronRight
                                                    size={12}
                                                    className="mt-1 ml-auto text-muted-foreground/30 group-hover/item:text-intranet-primary group-hover/item:translate-x-0.5 transition-all flex-shrink-0"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <div className="text-center py-12 px-2 border-2 border-dashed border-border rounded-xl">
                        <HelpCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-medium text-foreground">No matches found</p>
                        <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaticQuestionLibrarySidebar;
