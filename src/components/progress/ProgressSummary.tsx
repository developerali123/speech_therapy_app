import React from 'react';
import { Card } from '../ui/Card';
import { AppStatistics } from '../../utils/statistics';
import { CheckCircle2, XCircle, HelpCircle, Clock, Mic, UserCheck } from 'lucide-react';

interface ProgressSummaryProps {
  stats: AppStatistics;
}

export const ProgressSummary: React.FC<ProgressSummaryProps> = ({ stats }) => {
  const statCards = [
    {
      label: 'Total Attempts',
      value: stats.totalAttempts,
      subtext: `${stats.todayAttempts} recorded today`,
      icon: Mic,
      color: 'text-teal-600 bg-teal-50 border-teal-100'
    },
    {
      label: 'Reviewed Attempts',
      value: stats.reviewedAttempts,
      subtext: stats.totalAttempts > 0 ? `${Math.round((stats.reviewedAttempts / stats.totalAttempts) * 100)}% evaluated` : 'No attempts',
      icon: UserCheck,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100'
    },
    {
      label: 'Correct',
      value: stats.correctCount,
      subtext: stats.accuracyRate !== null ? `${stats.accuracyRate}% of reviewed` : 'Pending review',
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100'
    },
    {
      label: 'Incorrect',
      value: stats.incorrectCount,
      subtext: 'Marked for retraining',
      icon: XCircle,
      color: 'text-rose-600 bg-rose-50 border-rose-100'
    },
    {
      label: 'Uncertain',
      value: stats.uncertainCount,
      subtext: 'Needs follow-up',
      icon: HelpCircle,
      color: 'text-amber-600 bg-amber-50 border-amber-100'
    },
    {
      label: 'Pending Review',
      value: stats.pendingReviewCount,
      subtext: 'Awaiting therapist',
      icon: Clock,
      color: 'text-slate-600 bg-slate-100 border-slate-200'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {statCards.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.label}
            padding="md"
            className="flex flex-col justify-between relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500">
                {item.label}
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${item.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {item.value}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                {item.subtext}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
