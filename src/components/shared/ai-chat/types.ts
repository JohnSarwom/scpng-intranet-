export interface AIChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    fullText?: string;
    isTyping?: boolean;
    timestamp: Date;
    followUpQuestions?: string[];
}
