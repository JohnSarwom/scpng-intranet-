import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LabelList,
} from 'recharts';

// Status colour mapping — used for per-bar coloring
const STATUS_COLOURS: Record<string, string> = {
  completed: '#16a34a',   // green
  achieved: '#16a34a',
  'on-track': '#2563eb',  // blue
  'needs-attention': '#f59e0b', // amber
  behind: '#f97316',      // orange
  'at-risk': '#ef4444',   // red
  default: '#600018',     // brand maroon (fallback)
};

function getBarColour(status: string, progress: number): string {
  const s = (status || '').toLowerCase().replace(/\s+/g, '-');
  if (STATUS_COLOURS[s]) return STATUS_COLOURS[s];
  // Infer from progress if no explicit status
  if (progress >= 100) return STATUS_COLOURS['completed'];
  if (progress >= 50) return STATUS_COLOURS['on-track'];
  if (progress >= 25) return STATUS_COLOURS['needs-attention'];
  return STATUS_COLOURS['at-risk'];
}

export interface BarChartDataItem {
  name: string;
  current: number;
  target?: number;  // kept for API compatibility but no longer rendered
  status?: string;
}

interface BarChartProps {
  title: string;
  description?: string;
  data: BarChartDataItem[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

const BarChart: React.FC<BarChartProps> = ({ title, description, data }) => {
  // Sort ascending by progress so lowest-performing objectives appear at the top
  const sorted = [...data].sort((a, b) => (a.current ?? 0) - (b.current ?? 0));

  // Dynamic height: minimum 300px, grows with number of items
  const chartHeight = Math.max(300, sorted.length * 48);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div style={{ height: chartHeight }} className="w-full">
          <ChartContainer
            className="aspect-auto h-full w-full"
            config={{ current: { color: '#600018' } }}
          >
            <RechartsBarChart
              data={sorted}
              layout="vertical"
              margin={{ top: 8, right: 64, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={160}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) =>
                  v.length > 28 ? `${v.slice(0, 28)}…` : v
                }
              />
              <ChartTooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                content={
                  <ChartTooltipContent
                    formatter={(value, name, props) => {
                      const status = props?.payload?.status || '';
                      return [`${value}%${status ? ` · ${status}` : ''}`, 'Progress'];
                    }}
                  />
                }
              />
              <Bar
                dataKey="current"
                name="Progress"
                radius={[0, 4, 4, 0]}
                maxBarSize={32}
              >
                {sorted.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColour(entry.status || '', entry.current ?? 0)}
                  />
                ))}
                <LabelList
                  dataKey="current"
                  position="right"
                  formatter={(v: number) => `${v}%`}
                  style={{ fontSize: 11, fontWeight: 600, fill: 'currentColor' }}
                />
              </Bar>
            </RechartsBarChart>
          </ChartContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-[10px] text-muted-foreground">
          {[
            { label: 'Completed', color: STATUS_COLOURS.completed },
            { label: 'On Track', color: STATUS_COLOURS['on-track'] },
            { label: 'Needs Attention', color: STATUS_COLOURS['needs-attention'] },
            { label: 'At Risk', color: STATUS_COLOURS['at-risk'] },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default BarChart;
