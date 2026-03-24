import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Task } from '@/types';
import { calculateTaskTrends } from '@/utils/dashboardUtils';

interface DivisionPerformanceTrendsProps {
  tasks: Task[];
}

export const DivisionPerformanceTrends: React.FC<DivisionPerformanceTrendsProps> = ({ tasks }) => {
  const trendData = useMemo(() => calculateTaskTrends(tasks, 6), [tasks]);

  return (
    <Card className="group relative">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Performance Trends</CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Performance Trends</DialogTitle>
              <DialogDescription>Workload inflow vs. outflow tracking</DialogDescription>
            </DialogHeader>
            <div className="text-sm space-y-4">
              <p>This graph visualizes the division's productivity by comparing the number of new tasks assigned against the number of tasks completed each month.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Completed (Green):</strong> Tasks that reached 'Done' status in that month.</li>
                <li><strong>Added (Maroon):</strong> New tasks created or assigned to the division.</li>
                <li><strong>Significance:</strong> Identifies if the team is keeping up with demand or if a backlog is forming.</li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>
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
