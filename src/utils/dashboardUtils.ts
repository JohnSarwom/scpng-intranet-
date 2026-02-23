import { Task, Project, Objective } from '@/types';
import { TrafficLightCardProps } from '@/components/dashboard/TrafficLightCard';

export interface TaskTrendData {
    name: string;
    completed: number;
    added: number;
}

// Helper to get Month Name
const getMonthName = (date: Date) => {
    return date.toLocaleString('default', { month: 'short' });
};

// Helper to get YYYY-MM key
const getMonthKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const calculateTaskTrends = (tasks: Task[], monthsBack: number = 6): TaskTrendData[] => {
    const today = new Date();
    const result: Record<string, { name: string; completed: number; added: number }> = {};

    // Initialize last N months
    for (let i = monthsBack - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = getMonthKey(d);
        result[key] = {
            name: getMonthName(d),
            completed: 0,
            added: 0
        };
    }

    tasks.forEach(task => {
        // Added Count
        if (task.createdAt) {
            const createdDate = new Date(task.createdAt);
            const key = getMonthKey(createdDate);
            if (result[key]) {
                result[key].added++;
            }
        }

        // Completed Count
        // Use completedAt if available, otherwise if status is done/completed use modified date (proxy)
        if ((task.status as any) === 'done' || task.status === 'completed' || (task.tags && task.tags.includes('completed'))) {
            const completedDateStr = task.completedAt || (task as any).updatedAt || (task as any).modifiedAt;
            // Note: Types might not have updatedAt mapped at top level yet, but we are checking runtime or if mapped
            // Usage of 'createdAt' for completed time is fallback if nothing else, but inaccurate.
            // Better to skip if no completed date.

            if (completedDateStr) {
                const completedDate = new Date(completedDateStr);
                const key = getMonthKey(completedDate);
                if (result[key]) {
                    result[key].completed++;
                }
            } else if (task.completedAt) { // Explicit check
                const completedDate = new Date(task.completedAt);
                const key = getMonthKey(completedDate);
                if (result[key]) {
                    result[key].completed++;
                }
            }
        }
    });

    return Object.values(result);
};

export const calculateTrafficLightMetrics = (
    tasks: Task[],
    projects: Project[],
    objectives: Objective[]
): TrafficLightCardProps[] => {

    // 1. Strategic Alignment (Objectives)
    // Score: Average Progress of Org/Strat Objectives
    // Status: > 70 Good, > 40 Warning, < 40 Critical

    const strategicObjs = objectives.filter(o => !o.goalType || o.goalType === 'Strategic' || o.goalType === 'Org');
    const avgProgress = strategicObjs.length > 0
        ? strategicObjs.reduce((acc, curr) => acc + (curr.progress || 0), 0) / strategicObjs.length
        : 0;

    const stratScore = Math.round(avgProgress);
    const stratStatus = stratScore >= 70 ? 'good' : stratScore >= 40 ? 'warning' : 'critical';

    // 2. Operational Health (Tasks)
    // Score: % of Tasks that are NOT Overdue
    // Status: > 80 Good, > 60 Warning, < 60 Critical

    const openTasks = tasks.filter(t =>
        (t.status as any) !== 'done' &&
        t.status !== 'completed' &&
        (t.status as any) !== 'review' &&
        t.status !== 'in-review'
    ); // Active tasks
    // Mock check for overdue since we need date logic.
    // Real logic: Date.parse(dueDate) < Date.now()
    const overdueTasks = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
    const healthRatio = openTasks.length > 0
        ? ((openTasks.length - overdueTasks.length) / openTasks.length) * 100
        : 100; // If no tasks, 100% healthy?

    const opScore = Math.round(healthRatio);
    const opStatus = opScore >= 80 ? 'good' : opScore >= 60 ? 'warning' : 'critical';

    // 3. Projects (Projects)
    // Score: Progress or % On Track
    const activeProjects = projects.filter(p => p.status === 'in-progress' || p.status === 'planned');
    const onTrackProjects = activeProjects.filter(p => p.status === 'in-progress'); // Simplified proxy
    const projectScore = activeProjects.length > 0
        ? Math.round((onTrackProjects.length / activeProjects.length) * 100)
        : 0;

    const projStatus = projectScore >= 70 ? 'good' : projectScore >= 40 ? 'warning' : 'critical';


    return [
        {
            category: "Strategic Alignment",
            status: stratStatus,
            score: stratScore,
            trend: "up", // Placeholder as we don't have historical snapshots of progress
            items: [
                { label: "Active Objectives", value: strategicObjs.length.toString(), status: "good" },
                { label: "Avg Progress", value: `${Math.round(avgProgress)}%`, status: stratStatus },
            ]
        },
        {
            category: "Operational Health",
            status: opStatus,
            score: opScore,
            trend: "flat",
            items: [
                { label: "Open Tasks", value: openTasks.length.toString(), status: "warning" },
                { label: "Overdue", value: overdueTasks.length.toString(), status: overdueTasks.length > 5 ? 'critical' : 'good' },
            ]
        },
        {
            category: "Projects",
            status: projStatus,
            score: projectScore,
            trend: "up",
            items: [
                { label: "Active", value: activeProjects.length.toString(), status: "good" },
                { label: "On Track", value: onTrackProjects.length.toString(), status: "good" },
            ]
        }
    ];
};
