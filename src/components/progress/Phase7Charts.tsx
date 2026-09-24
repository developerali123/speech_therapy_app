import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { Card } from '../ui/Card';
import { DailyChartPoint } from '../../utils/statistics';
import { BarChart3, TrendingUp, CheckCircle, Clock } from 'lucide-react';

interface Phase7ChartsProps {
  data: DailyChartPoint[];
}

export const Phase7Charts: React.FC<Phase7ChartsProps> = ({ data }) => {
  const [activeChart, setActiveChart] = useState<
    'attempts' | 'audioTrend' | 'therapistTrend' | 'duration'
  >('attempts');

  // Chart Tabs
  const tabs = [
    { id: 'attempts', label: 'Attempts Per Day', icon: BarChart3 },
    { id: 'audioTrend', label: 'Audio Result Trend', icon: TrendingUp },
    { id: 'therapistTrend', label: 'Therapist Result Trend', icon: CheckCircle },
    { id: 'duration', label: 'Practice Duration', icon: Clock }
  ] as const;

  return (
    <Card className="p-4 sm:p-6 bg-white space-y-4">
      {/* Header and Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Practice Trend & Analytics Charts
          </h3>
          <p className="text-xs text-slate-500">
            Interactive visual history over the past 7 days
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeChart === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveChart(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart Display Area */}
      <div className="h-64 sm:h-72 w-full pt-1">
        {/* 1. ATTEMPTS PER DAY */}
        {activeChart === 'attempts' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const pt = payload[0].payload as DailyChartPoint;
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-xs space-y-1">
                        <p className="font-bold border-b border-slate-800 pb-1">{label} ({pt.fullDate})</p>
                        <p className="flex justify-between gap-4">
                          <span className="text-teal-300">Attempts:</span>
                          <span className="font-mono font-bold">{pt.attempts}</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="attempts"
                name="Attempts"
                fill="#0d9488"
                radius={[6, 6, 0, 0]}
                maxBarSize={44}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* 2. AUDIO-BASED RESULT TREND */}
        {activeChart === 'audioTrend' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="audioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#94a3b8"
                fontSize={11}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const pt = payload[0].payload as DailyChartPoint;
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-xs space-y-1">
                        <p className="font-bold border-b border-slate-800 pb-1">{label}</p>
                        <p className="flex justify-between gap-4">
                          <span className="text-teal-300">Audio-based correct:</span>
                          <span className="font-mono font-bold">{pt.audioRate}%</span>
                        </p>
                        <p className="text-[10px] text-slate-400">Total attempts: {pt.attempts}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="audioRate"
                name="Audio-based Result"
                stroke="#0d9488"
                strokeWidth={3}
                fill="url(#audioGradient)"
                dot={{ r: 4, fill: '#0d9488', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* 3. THERAPIST-CONFIRMED RESULT TREND */}
        {activeChart === 'therapistTrend' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#94a3b8"
                fontSize={11}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const pt = payload[0].payload as DailyChartPoint;
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-xs space-y-1">
                        <p className="font-bold border-b border-slate-800 pb-1">{label}</p>
                        <p className="flex justify-between gap-4">
                          <span className="text-indigo-300">Therapist Confirmed:</span>
                          <span className="font-mono font-bold">
                            {pt.therapistRate !== null ? `${pt.therapistRate}%` : 'Pending review'}
                          </span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="therapistRate"
                name="Therapist Confirmed %"
                stroke="#4f46e5"
                strokeWidth={3}
                connectNulls={false}
                dot={{ r: 4, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* 4. PRACTICE DURATION */}
        {activeChart === 'duration' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickFormatter={(v) => `${v}m`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const pt = payload[0].payload as DailyChartPoint;
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-xs space-y-1">
                        <p className="font-bold border-b border-slate-800 pb-1">{label}</p>
                        <p className="flex justify-between gap-4">
                          <span className="text-amber-300">Practice Duration:</span>
                          <span className="font-mono font-bold">{pt.durationMinutes} min</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="durationMinutes"
                name="Practice Duration (min)"
                fill="#d97706"
                radius={[6, 6, 0, 0]}
                maxBarSize={44}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Explanatory legend below charts */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <span>X-Axis represents practice calendar dates</span>
        <span>
          {activeChart === 'audioTrend' && 'Audio-based results are calculated automatically.'}
          {activeChart === 'therapistTrend' && 'Only therapist-reviewed recordings count in this trend.'}
          {activeChart === 'attempts' && 'Number of voice attempts recorded per day.'}
          {activeChart === 'duration' && 'Total recording time captured.'}
        </span>
      </div>
    </Card>
  );
};
