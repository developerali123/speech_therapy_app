import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { Card } from '../ui/Card';
import { DailyPracticeStats } from '../../types';

interface PracticeChartProps {
  data: (DailyPracticeStats & { dayName: string })[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload: DailyPracticeStats & { dayName: string };
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1 border border-slate-800">
        <p className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1.5">
          {label} ({item.date})
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-teal-300">Attempts:</span>
          <span className="font-mono font-bold">{item.attempts}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-slate-400">Reviewed:</span>
          <span className="font-mono">{item.reviewedAttempts}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span className="text-emerald-400">Correct Rate:</span>
          <span className="font-mono font-bold">
            {item.reviewedAttempts > 0 ? `${item.correctPercentage}%` : 'N/A (Pending)'}
          </span>
        </p>
        {item.reviewedAttempts === 0 && item.attempts > 0 && (
          <p className="text-[10px] text-amber-300 italic pt-1">
            * Pending therapist clinical review
          </p>
        )}
      </div>
    );
  }
  return null;
};

export const PracticeChart: React.FC<PracticeChartProps> = ({ data }) => {
  return (
    <Card className="p-4 sm:p-6 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Weekly Practice Chart
          </h3>
          <p className="text-xs text-slate-500">
            Daily attempts and therapist-confirmed accuracy (past 7 days)
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-teal-500" />
            Attempts
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded bg-emerald-500" />
            Confirmed Correct %
          </span>
        </div>
      </div>

      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="dayName"
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            {/* Left Axis: Attempts Count */}
            <YAxis
              yAxisId="left"
              stroke="#94a3b8"
              fontSize={11}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
            />
            {/* Right Axis: Accuracy Percentage (0 to 100%) */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              stroke="#94a3b8"
              fontSize={11}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              yAxisId="left"
              dataKey="attempts"
              name="Attempts"
              fill="#0d9488"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="correctPercentage"
              name="Correct %"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-slate-400 mt-2 text-center">
        * Accuracy reflects therapist-confirmed reviews only. Unreviewed attempts are marked pending.
      </p>
    </Card>
  );
};
