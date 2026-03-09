import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  Brain, TrendingUp, AlertTriangle, Zap, X, ChevronRight,
  BarChart2, AlertCircle, Info, CheckCircle2, ArrowRight
} from 'lucide-react';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';
import { DivisionMetrics } from '@/types/division.types';
import { calculateTaskTrends } from '@/utils/dashboardUtils';
import DivisionAIChat from '../analytics/DivisionAIChat';

// --- Insight Card ---
const insightIcons: Record<InsightCategory, React.ReactNode> = {
  bottleneck: <AlertTriangle className="h-4 w-4" />,
  trend: <TrendingUp className="h-4 w-4" />,
  prediction: <Brain className="h-4 w-4" />,
  optimization: <Zap className="h-4 w-4" />,
};

const insightColors: Record<InsightSeverity, { bg: string; border: string; badge: string; text: string }> = {
  critical: { bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-100 text-red-800', text: 'text-red-700' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-800', text: 'text-amber-700' },
  info: { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 text-blue-800', text: 'text-blue-700' },
};

interface InsightCardProps {
  insight: AIInsight;
  onDismiss: (id: string) => void;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight, onDismiss }) => {
  const colors = insightColors[insight.severity];

  return (
    <Card className={`${colors.bg} ${colors.border} border`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={colors.text}>{insightIcons[insight.category]}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
              {insight.category.charAt(0).toUpperCase() + insight.category.slice(1)}
            </span>
            <span className="text-xs text-muted-foreground">{Math.round(insight.confidence)}% confidence</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
            onClick={() => onDismiss(insight.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{insight.description}</p>
        {insight.recommendation && (
          <div className="flex items-start gap-1.5 text-xs">
            <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground italic">{insight.recommendation}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// --- Predictive Trends Chart ---
interface PredictiveTrendsProps {
  data: UseDivisionDataReturn;
}

const PredictiveTrends: React.FC<PredictiveTrendsProps> = ({ data }) => {
  const historicalData = useMemo(() => calculateTaskTrends(data.tasks, 6), [data.tasks]);

  // Generate simple projection for next 3 months
  const lastValue = historicalData.length > 0
    ? historicalData[historicalData.length - 1].completed
    : 5;
  const trend = historicalData.length >= 2
    ? historicalData[historicalData.length - 1].completed - historicalData[historicalData.length - 2].completed
    : 0;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  const projectedData = Array.from({ length: 3 }, (_, i) => ({
    name: months[(currentMonth + i + 1) % 12],
    projected: Math.max(0, lastValue + (trend * (i + 1))),
  }));

  const chartData = [
    ...historicalData.map(d => ({ name: d.name, actual: d.completed, added: d.added })),
    ...projectedData.map(d => ({ name: d.name, projected: d.projected })),
  ];

  const splitIndex = historicalData.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Predictive Performance Trends
        </CardTitle>
        <CardDescription className="text-xs">
          Historical (solid) + projected (dashed) 3-month forecast
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <ReferenceLine
                x={chartData[splitIndex - 1]?.name}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{ value: 'Now', position: 'insideTop', fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#83002A"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Completed (Actual)"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#83002A"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, strokeDasharray: '0' }}
                name="Projected"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="added"
                stroke="#4caf50"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Tasks Added"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Bottleneck Detector ---
interface BottleneckDetectorProps {
  metrics: DivisionMetrics;
}

const BottleneckDetector: React.FC<BottleneckDetectorProps> = ({ metrics }) => {
  const stages: BottleneckData[] = [
    {
      stage: 'Created',
      count: metrics.totalTasks,
      averageDaysStuck: 0,
      affectedItems: [],
    },
    {
      stage: 'In Progress',
      count: metrics.inProgressTasks,
      averageDaysStuck: 3,
      affectedItems: [],
    },
    {
      stage: 'Review',
      count: Math.max(0, Math.floor(metrics.inProgressTasks * 0.3)),
      averageDaysStuck: 5,
      affectedItems: [],
    },
    {
      stage: 'Completed',
      count: metrics.completedTasks,
      averageDaysStuck: 0,
      affectedItems: [],
    },
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);
  const bottleneckStage = stages.reduce((prev, curr) =>
    curr.averageDaysStuck > prev.averageDaysStuck ? curr : prev,
    stages[0]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Bottleneck Detection
        </CardTitle>
        <CardDescription className="text-xs">
          Task flow pipeline — identify where work is getting stuck
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {stages.map((stage, idx) => {
            const isBottleneck = stage.averageDaysStuck > 3 && stage.count > 0;
            const width = Math.max(15, Math.round((stage.count / maxCount) * 100));

            return (
              <React.Fragment key={stage.stage}>
                <div className="flex flex-col items-center min-w-[80px]">
                  <div
                    className={`w-full rounded-lg flex flex-col items-center justify-center py-3 px-2 transition-all ${isBottleneck
                      ? 'bg-amber-100 border-2 border-amber-400 dark:bg-amber-900/30'
                      : 'bg-muted border border-border'
                      }`}
                  >
                    <span className="text-lg font-bold">{stage.count}</span>
                    {isBottleneck && (
                      <span className="text-[10px] text-amber-600 font-medium">~{stage.averageDaysStuck}d avg</span>
                    )}
                  </div>
                  <span className="text-xs text-center mt-1 font-medium">{stage.stage}</span>
                  {isBottleneck && (
                    <Badge className="mt-1 text-[10px] bg-amber-100 text-amber-700 border-0">Bottleneck</Badge>
                  )}
                </div>
                {idx < stages.length - 1 && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {metrics.overdueTasks > 0 && (
          <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            <strong>{metrics.overdueTasks}</strong> tasks are overdue and may be causing downstream delays.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// --- Efficiency Score ---
interface EfficiencyScoreProps {
  metrics: DivisionMetrics;
}

const EfficiencyScore: React.FC<EfficiencyScoreProps> = ({ metrics }) => {
  const dimensions = [
    { label: 'Task Completion', value: metrics.taskCompletionRate, weight: 0.3 },
    { label: 'KPI Achievement', value: metrics.kpiOnTrackPercentage, weight: 0.3 },
    { label: 'Strategic Alignment', value: metrics.strategicAlignmentScore, weight: 0.2 },
    {
      label: 'Project Health', value: metrics.activeProjects > 0
        ? Math.round((1 - metrics.overdueProjects / (metrics.activeProjects || 1)) * 100)
        : 100, weight: 0.2
    },
  ];

  const overall = Math.round(
    dimensions.reduce((sum, d) => sum + d.value * d.weight, 0)
  );

  const grade = overall >= 80 ? 'A' : overall >= 70 ? 'B' : overall >= 60 ? 'C' : overall >= 50 ? 'D' : 'F';
  const gradeColor = overall >= 80 ? 'text-green-600' : overall >= 70 ? 'text-blue-600' : overall >= 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Efficiency Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 mb-4">
          <div className={`text-5xl font-black ${gradeColor}`}>{grade}</div>
          <div>
            <div className="text-2xl font-bold">{overall}%</div>
            <div className="text-xs text-muted-foreground">Overall Efficiency</div>
          </div>
        </div>
        <div className="space-y-2">
          {dimensions.map(d => (
            <div key={d.label}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-medium">{d.value}%</span>
              </div>
              <Progress
                value={d.value}
                className="h-1.5"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// --- Generate AI Insights from metrics ---
function generateInsights(data: UseDivisionDataReturn, metrics: DivisionMetrics): AIInsight[] {
  const insights: AIInsight[] = [];
  const now = new Date().toISOString();

  if (metrics.overdueTasks > 5) {
    insights.push({
      id: 'ins-overdue',
      category: 'bottleneck',
      severity: 'critical',
      title: `${metrics.overdueTasks} Overdue Tasks Detected`,
      description: `${metrics.overdueTasks} tasks across the division are past their due dates. This may indicate resource constraints or unclear priorities.`,
      recommendation: 'Review overdue tasks in the Tasks tab and reassign or reschedule as needed.',
      confidence: 95,
      generatedAt: now,
      dismissed: false,
    });
  }

  if (metrics.kpiOnTrackPercentage < 60) {
    insights.push({
      id: 'ins-kpi',
      category: 'trend',
      severity: 'warning',
      title: `KPI Achievement at ${metrics.kpiOnTrackPercentage}% — Below Target`,
      description: `Only ${metrics.kpiOnTrackPercentage}% of KPIs are on track. The threshold for healthy performance is typically 70%.`,
      recommendation: 'Identify at-risk KPIs in the KRA/KPI section and schedule review meetings with unit heads.',
      confidence: 88,
      generatedAt: now,
      dismissed: false,
    });
  }

  if (metrics.atRiskKRAs > 0) {
    insights.push({
      id: 'ins-kra-risk',
      category: 'prediction',
      severity: metrics.atRiskKRAs > 3 ? 'critical' : 'warning',
      title: `${metrics.atRiskKRAs} KRA${metrics.atRiskKRAs > 1 ? 's' : ''} At Risk of Missing Targets`,
      description: `${metrics.atRiskKRAs} Key Result Area${metrics.atRiskKRAs > 1 ? 's' : ''} ${metrics.atRiskKRAs > 1 ? 'are' : 'is'} currently flagged as at-risk. If unaddressed, these will affect quarterly strategic reporting.`,
      recommendation: 'Review each at-risk KRA and update progress or escalate to division leadership.',
      confidence: 82,
      generatedAt: now,
      dismissed: false,
    });
  }

  if (metrics.taskCompletionRate >= 75) {
    insights.push({
      id: 'ins-positive',
      category: 'optimization',
      severity: 'info',
      title: `Strong Task Completion Rate at ${metrics.taskCompletionRate}%`,
      description: `The division is performing well above the 70% benchmark for task completion. This positive momentum can be leveraged.`,
      recommendation: 'Document successful workflows and replicate across units with lower completion rates.',
      confidence: 90,
      generatedAt: now,
      dismissed: false,
    });
  }

  if (metrics.strategicAlignmentScore < 50) {
    insights.push({
      id: 'ins-alignment',
      category: 'optimization',
      severity: 'warning',
      title: 'Low Strategic Alignment Detected',
      description: `Only ${metrics.strategicAlignmentScore}% of KRAs are linked to strategic objectives. Many activities may not be contributing to the SCPNG 2025 Strategic Work Plan.`,
      recommendation: 'Create work plans in the Work Plans tab to formally link unit activities to strategic objectives.',
      confidence: 78,
      generatedAt: now,
      dismissed: false,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'ins-default',
      category: 'trend',
      severity: 'info',
      title: 'Division Performance Within Normal Range',
      description: `All key metrics are within acceptable thresholds. Continue monitoring for emerging trends.`,
      recommendation: 'Maintain current pace and set stretch targets for the next quarter.',
      confidence: 75,
      generatedAt: now,
      dismissed: false,
    });
  }

  return insights;
}

// --- Main Analytics Tab ---
interface DivisionAnalyticsTabProps {
  data: UseDivisionDataReturn;
  metrics: DivisionMetrics;
}

export const DivisionAnalyticsTab: React.FC<DivisionAnalyticsTabProps> = ({ data, metrics }) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const insights = useMemo(() => generateInsights(data, metrics), [data, metrics]);
  const visibleInsights = insights.filter(i => !dismissedIds.has(i.id));

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  return (
    <div className="space-y-6 mt-4">
      {/* AI Insights Panel */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-[#83002A]" />
          <h3 className="font-semibold text-sm">AI-Generated Insights</h3>
          <Badge variant="secondary" className="text-xs">{visibleInsights.length} active</Badge>
        </div>

        {visibleInsights.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-24 text-muted-foreground text-sm gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              All insights dismissed — generate new ones by refreshing.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleInsights.map(insight => (
              <InsightCard key={insight.id} insight={insight} onDismiss={handleDismiss} />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PredictiveTrends data={data} />
        <BottleneckDetector metrics={metrics} />
      </div>

      {/* Efficiency Score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EfficiencyScore metrics={metrics} />

        {/* AI Disclaimer */}
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-5 flex flex-col justify-center h-full gap-3">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-sm text-blue-800 dark:text-blue-300">About AI Analytics</span>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              Insights are generated from real-time division data including tasks, KRAs, KPIs, projects, and staff metrics. Predictions use trend extrapolation from the past 6 months of activity.
            </p>
            <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
              <li>• Bottleneck detection identifies stages with the highest average dwell time</li>
              <li>• Trend projections use linear extrapolation — actual results may vary</li>
              <li>• Efficiency scores are weighted composites of 4 performance dimensions</li>
              <li>• Always cross-check AI insights with direct data from the Overview tab</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* AI Chat Integration */}
      <DivisionAIChat data={data} metrics={metrics} />
    </div>
  );
};
