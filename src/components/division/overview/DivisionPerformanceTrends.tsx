import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Task } from '@/types';
import { calculateTaskTrends } from '@/utils/dashboardUtils';

interface DivisionPerformanceTrendsProps {
  tasks: Task[];
}

export const DivisionPerformanceTrends: React.FC<DivisionPerformanceTrendsProps> = ({ tasks }) => {
  const trendData = useMemo(() => calculateTaskTrends(tasks, 6), [tasks]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Performance Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#4caf50"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Completed"
              />
              <Line
                type="monotone"
                dataKey="added"
                stroke="#83002A"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Added"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
