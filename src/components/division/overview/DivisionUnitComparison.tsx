import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
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
import { UnitComparisonData } from '@/types/division.types';

interface DivisionUnitComparisonProps {
  unitComparisons: UnitComparisonData[];
}

export const DivisionUnitComparison: React.FC<DivisionUnitComparisonProps> = ({ unitComparisons }) => {
  const chartData = unitComparisons.map(u => ({
    name: u.unitName.replace(' Unit', ''),
    'Task Completion': u.taskCompletion,
    'KRA Progress': u.kraProgress,
    'Staff': u.staffCount,
  }));

  if (chartData.length === 0) {
    return (
    <Card className="group relative">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Unit Comparison</CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Unit Comparison</DialogTitle>
              <DialogDescription>Multi-unit performance benchmarking</DialogDescription>
            </DialogHeader>
            <div className="text-sm space-y-4">
              <p>This graph compares execution performance across the division's specialized units, identifying areas of operational excellence or potential bottlenecks.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Task Completion (Maroon):</strong> Percentage of work finalized by the unit.</li>
                <li><strong>KRA Progress (Green):</strong> Average progress towards strategic Key Result Areas.</li>
                <li><strong>Significance:</strong> Essential for strategic resource allocation and highlighting high-performing business units.</li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            No unit data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group relative">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Unit Comparison</CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Unit Comparison</DialogTitle>
              <DialogDescription>Multi-unit performance benchmarking</DialogDescription>
            </DialogHeader>
            <div className="text-sm space-y-4">
              <p>This graph compares execution performance across the division's specialized units, identifying areas of operational excellence or potential bottlenecks.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Task Completion (Maroon):</strong> Percentage of work finalized by the unit.</li>
                <li><strong>KRA Progress (Green):</strong> Average progress towards strategic Key Result Areas.</li>
                <li><strong>Significance:</strong> Essential for strategic resource allocation and highlighting high-performing business units.</li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="Task Completion" fill="#83002A" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="KRA Progress" fill="#4caf50" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
