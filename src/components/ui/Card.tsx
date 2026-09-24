import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'outline' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className,
  ...props
}) => {
  const base = 'bg-white rounded-2xl transition-all duration-200';

  const variants = {
    default: 'border border-slate-200/80 shadow-xs shadow-slate-900/5',
    flat: 'bg-slate-50 border border-slate-100',
    outline: 'border border-slate-200 shadow-none',
    interactive: 'border border-slate-200/80 shadow-xs hover:border-teal-300 hover:shadow-md cursor-pointer active:scale-[0.99]'
  };

  const paddings = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8'
  };

  return (
    <div
      className={twMerge(clsx(base, variants[variant], paddings[padding], className))}
      {...props}
    >
      {children}
    </div>
  );
};
