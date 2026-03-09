export interface DivisionQuestion {
    id: string;
    text: string;
}

export interface DivisionQuestionCategory {
    id: string;
    title: string;
    questions: DivisionQuestion[];
}

export const DIVISION_QUICK_QUESTIONS: string[] = [
    "Executive Brief",
    "Where are our tasks bottlenecking?",
    "Summarize at-risk KRAs",
    "How is our staff workload distributed?",
    "What is the overall strategic alignment?"
];

export const DIVISION_QUESTION_LIBRARY: DivisionQuestionCategory[] = [
    {
        id: 'overview',
        title: 'Division Overview',
        questions: [
            { id: 'o1', text: 'Provide an executive summary of the division\'s overall health based on the data.' },
            { id: 'o2', text: 'How does our task completion rate compare to our KPI achievement?' },
            { id: 'o3', text: 'What is our strongest area of performance this quarter?' },
            { id: 'o4', text: 'Give a high-level breakdown of the staff composition by unit.' },
        ]
    },
    {
        id: 'tasks',
        title: 'Tasks & Operations',
        questions: [
            { id: 't1', text: 'Analyze the current task bottleneck data. Specifically, which stage are tasks stuck in?' },
            { id: 't2', text: 'List the currently overdue tasks and which units own them.' },
            { id: 't3', text: 'Based on recent trends, is our task backlog growing or shrinking?' },
            { id: 't4', text: 'Which unit has the most active tasks?' },
        ]
    },
    {
        id: 'strategy',
        title: 'Strategy & Execution (KRAs)',
        questions: [
            { id: 's1', text: 'Identify any KRAs or KPIs that are currently marked as "At-Risk" or "Off-Track".' },
            { id: 's2', text: 'Summarize the progress of our strategic execution against our objectives.' },
            { id: 's3', text: 'What percentage of our KPIs are currently on track?' },
            { id: 's4', text: 'Are there any units struggling to meet their KPI targets?' },
        ]
    },
    {
        id: 'staff',
        title: 'Staff & Roles',
        questions: [
            { id: 'r1', text: 'Give me a breakdown of staff members grouped by their designated units.' },
            { id: 'r2', text: 'Can you summarize the different job titles or roles currently active in the division?' },
            { id: 'r3', text: 'Which unit possesses the most assigned human resources?' },
        ]
    },
    {
        id: 'recommendations',
        title: 'Recommendations & Actions',
        questions: [
            { id: 'rec1', text: 'Based on the bottlenecks and overdue metrics, what immediate operational acts should the Director take?' },
            { id: 'rec2', text: 'Suggest ways to improve our division\'s Strategic Alignment score.' },
            { id: 'rec3', text: 'What areas should be prioritized in the upcoming team meeting?' },
        ]
    }
];
