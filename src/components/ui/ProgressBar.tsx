import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showCount?: boolean;
  color?: 'teal' | 'emerald' | 'amber' | 'rose';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  label,
  showCount = false,
  color = 'teal',
  size = 'md',
  className
}) => {
  const percentage = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;

  const colorClasses = {
    teal: 'bg-teal-600',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500'
  };

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4'
  };

  return (
    <div className={twMerge('w-full', className)}>
      {(label || showCount) && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-600 mb-1.5">
          <span>{label}</span>
          {showCount && (
            <span className="text-slate-800 font-semibold">
              {value} / {max} ({percentage}%)
            </span>
          )}
        </div>
      )}
      <div
        className={twMerge(
          'w-full bg-slate-100 rounded-full overflow-hidden',
          heightClasses[size]
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || 'Progress bar'}
      >
        <div
          className={twMerge(
            'h-full rounded-full transition-all duration-300 ease-out',
            colorClasses[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
