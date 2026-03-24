export interface AnalyticsQuestionCategory {
    id: string;
    title: string;
    questions: { id: string; text: string }[];
}

export const ANALYTICS_QUICK_QUESTIONS: string[] = [
    "Executive Brief",
    "What are the most visited pages?",
    "Where is our traffic coming from?",
    "What devices do visitors use?",
    "Identify traffic trends this month"
];

export const OVERVIEW_QUICK_QUESTIONS: string[] = [
    "Cross-Platform Summary",
    "Which platform has most reach?",
    "Engagement trends across sources",
    "Audience growth comparison",
    "Top performing content"
];

export const ANALYTICS_QUESTION_LIBRARY: AnalyticsQuestionCategory[] = [
    {
        id: 'cross-platform',
        title: 'Cross-Platform Performance',
        questions: [
            { id: 'cp1', text: 'Compare reach across Website, Facebook, and LinkedIn.' },
            { id: 'cp2', text: 'Which platform is currently seeing the highest engagement rate?' },
            { id: 'cp3', text: 'Analyze the cross-platform trend for the last 14 days.' },
            { id: 'cp4', text: 'Which audience segment is growing fastest across all channels?' }
        ]
    },
    {
        id: 'overview',
        title: 'Traffic Overview',
        questions: [
            { id: 'o1', text: 'Provide an executive summary of website traffic performance.' },
            { id: 'o2', text: 'What is the overall trend in page views and unique visitors?' },
            { id: 'o3', text: 'How does this month compare to last month in key metrics?' },
            { id: 'o4', text: 'What is the current bounce rate and what might be causing it?' }
        ]
    },
    {
        id: 'social-media',
        title: 'Social Media Insights',
        questions: [
            { id: 'sm1', text: 'How is our Facebook reach trending compared to LinkedIn?' },
            { id: 'sm2', text: 'Which social media platform drives more traffic to the website?' },
            { id: 'sm3', text: 'Analyze social media engagement trends this month.' },
            { id: 'sm4', text: 'What content performs best on our social channels?' }
        ]
    },
    {
        id: 'pages',
        title: 'Page Performance',
        questions: [
            { id: 'p1', text: 'Which pages have the highest and lowest engagement?' },
            { id: 'p2', text: 'What pages have the longest average time on page?' },
            { id: 'p3', text: 'Are there any pages with unusually high bounce rates?' },
            { id: 'p4', text: 'Which content categories attract the most visitors?' }
        ]
    },
    {
        id: 'sources',
        title: 'Traffic Sources',
        questions: [
            { id: 's1', text: 'What are the top referral sources driving traffic?' },
            { id: 's2', text: 'How much of our traffic comes from search engines vs direct?' },
            { id: 's3', text: 'Which social media platform sends the most visitors?' },
            { id: 's4', text: 'Are there any new referral sources appearing recently?' }
        ]
    },
    {
        id: 'audience',
        title: 'Audience Insights',
        questions: [
            { id: 'a1', text: 'What is the geographic distribution of our visitors?' },
            { id: 'a2', text: 'What percentage of visitors are from Papua New Guinea vs international?' },
            { id: 'a3', text: 'What is the ratio of new vs returning visitors?' },
            { id: 'a4', text: 'What browsers and devices are most commonly used?' }
        ]
    },
    {
        id: 'recommendations',
        title: 'Recommendations',
        questions: [
            { id: 'r1', text: 'What are the top 3 areas for improvement based on the analytics data?' },
            { id: 'r2', text: 'Which pages should we prioritize for optimization?' },
            { id: 'r3', text: 'What content strategy changes would increase engagement?' },
            { id: 'r4', text: 'How can we improve traffic from search engines?' }
        ]
    }
];
