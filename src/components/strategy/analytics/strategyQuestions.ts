export interface StrategyQuestion {
    id: string;
    text: string;
}

export interface StrategyQuestionCategory {
    id: string;
    title: string;
    questions: StrategyQuestion[];
}

export const STRATEGY_QUICK_QUESTIONS: string[] = [
    "What is the overall strategic progress?",
    "Which division is underperforming?",
    "What objectives are at risk?",
    "Summarize KPI completion rates",
];

export const STRATEGY_QUESTION_LIBRARY: StrategyQuestionCategory[] = [
    {
        id: 'overview',
        title: 'Strategic Overview',
        questions: [
            { id: 'o1', text: 'What is the overall completion rate across all strategic objectives?' },
            { id: 'o2', text: 'How does current progress compare to our targets for this quarter?' },
            { id: 'o3', text: 'Which strategic pillars are performing above or below expectations?' },
            { id: 'o4', text: 'Provide an executive summary of the current strategic position.' },
        ]
    },
    {
        id: 'divisions',
        title: 'Divisional Performance',
        questions: [
            { id: 'd1', text: 'Compare the performance of all divisions in the current cycle.' },
            { id: 'd2', text: 'Which division has the highest and lowest completion rates?' },
            { id: 'd3', text: 'What are the key bottlenecks in each division?' },
            { id: 'd4', text: 'How is the Legal Services Division progressing on regulatory reform?' },
        ]
    },
    {
        id: 'risk',
        title: 'Risk & Attention Areas',
        questions: [
            { id: 'r1', text: 'Which objectives are currently at risk and why?' },
            { id: 'r2', text: 'What milestones are approaching their deadlines with low progress?' },
            { id: 'r3', text: 'Are there any KRAs with zero progress that need immediate attention?' },
            { id: 'r4', text: 'What are the top 3 risks to strategic plan execution?' },
        ]
    },
    {
        id: 'execution',
        title: 'Execution & KPIs',
        questions: [
            { id: 'e1', text: 'What is the completion rate of strategic executions (featured projects)?' },
            { id: 'e2', text: 'Which KPIs are behind target and by how much?' },
            { id: 'e3', text: 'How many KRAs have all their KPIs completed?' },
            { id: 'e4', text: 'What is the average time to complete a KRA across all units?' },
        ]
    },
    {
        id: 'recommendations',
        title: 'Recommendations',
        questions: [
            { id: 'rec1', text: 'What actions should leadership prioritize this quarter?' },
            { id: 'rec2', text: 'How can we improve the execution rate of strategic objectives?' },
            { id: 'rec3', text: 'What resource reallocation would you recommend based on current progress?' },
        ]
    }
];
