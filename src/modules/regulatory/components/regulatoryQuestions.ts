export interface RegulatoryQuestion {
    id: string;
    text: string;
}

export interface RegulatoryQuestionCategory {
    id: string;
    title: string;
    questions: RegulatoryQuestion[];
}

export const REGULATORY_QUICK_QUESTIONS: string[] = [
    "Executive Brief",
    "What are the most recent scams?",
    "Summarize high risk whistleblowers",
    "How many active investigations are there?",
    "Identify trends in compliance cases"
];

export const REGULATORY_QUESTION_LIBRARY: RegulatoryQuestionCategory[] = [
    {
        id: 'overview',
        title: 'Regulatory Overview',
        questions: [
            { id: 'o1', text: 'Provide an executive summary of the current regulatory environment.' },
            { id: 'o2', text: 'What is the breakdown of cases by risk level?' },
            { id: 'o3', text: 'Which assigned unit has the most open cases right now?' },
            { id: 'o4', text: 'Are there any critical alerts that need immediate attention?' }
        ]
    },
    {
        id: 'scams',
        title: 'Scams & Investigations',
        questions: [
            { id: 's1', text: 'Summarize the most recently reported scam cases.' },
            { id: 's2', text: 'What common categories or patterns appear in the active scams?' },
            { id: 's3', text: 'Which investigations have been open the longest?' },
            { id: 's4', text: 'Are there any high-risk investigations currently under review?' }
        ]
    },
    {
        id: 'whistleblower',
        title: 'Whistleblower Reports',
        questions: [
            { id: 'w1', text: 'Summarize the high-risk whistleblower reports.' },
            { id: 'w2', text: 'How many whistleblower reports are anonymous vs named?' },
            { id: 'w3', text: 'Are there any patterns in the departments or subjects being reported?' },
            { id: 'w4', text: 'What is the current status distribution of the whistleblower cases?' }
        ]
    },
    {
        id: 'compliance',
        title: 'Compliance & Enquiries',
        questions: [
            { id: 'c1', text: 'What are the main topics of recent public enquiries?' },
            { id: 'c2', text: 'Summarize the open compliance issues.' },
            { id: 'c3', text: 'Are there any compliance cases escalated to high risk?' },
            { id: 'c4', text: 'What is the average status of enquiries (e.g., received vs resolved)?' }
        ]
    },
    {
        id: 'analysis',
        title: 'Analysis & Recommendations',
        questions: [
            { id: 'a1', text: 'What are the top 3 regulatory risks right now based on the data?' },
            { id: 'a2', text: 'Based on the case volume, which unit might need more resources?' },
            { id: 'a3', text: 'What immediate actions should the enforcement team take?' }
        ]
    }
];
