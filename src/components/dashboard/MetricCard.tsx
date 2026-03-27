
import React from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer
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

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trend: number;
  data: Array<{ value: number }>;
  trendType: 'increase' | 'decrease';
  trendLabel: string;
  color: string;
  info?: {
    title: string;
    description: string;
    content: React.ReactNode;
  };
  literalCalculation?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  data,
  trendType,
  trendLabel,
  color,
  info,
  literalCalculation
}) => {
  const trendColor = trendType === 'increase'
    ? 'text-intranet-success bg-green-50 dark:bg-intranet-success/10'
    : 'text-intranet-danger bg-red-50 dark:bg-intranet-danger/10';

  const trendSign = trendType === 'increase' ? '+' : '-';

  const cardContent = (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm h-full animate-fade-in border dark:border-white/10 relative">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{title}</h3>

      <div className="flex justify-between items-start">
        <div>
          <span className="text-3xl font-bold block dark:text-white">{value}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</span>
        </div>

        <div className="w-24 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="text-xs text-[#B76E79] dark:text-[#D4A5A9]">
          {literalCalculation && <span>{literalCalculation}</span>}
        </div>
        <div>
          <span className={`inline-block px-2 py-1 rounded-full text-xs ${trendColor}`}>
            {trendSign}{Math.abs(trend)}% {trendLabel}
          </span>
        </div>
      </div>
    </div>
  );

  if (info) {
    return (
      <Dialog>
        <div className="relative h-full group">
          <div className="absolute top-2 right-2 z-10">
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DialogTrigger>
          </div>
          {cardContent}
        </div>
        <DialogContent className="max-w-md dark:bg-gray-900 dark:border-white/10 dark:text-gray-100">
          <DialogHeader>
            <DialogTitle>{info.title}</DialogTitle>
            <DialogDescription>{info.description}</DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            {info.content}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return cardContent;
};

export default MetricCard;
