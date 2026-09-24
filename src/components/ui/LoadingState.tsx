import React from 'react';
import { Card } from './Card';

interface LoadingStateProps {
  message?: string;
  subtext?: string;
  card?: boolean;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  subtext = 'Please wait while we prepare your space.',
  card = false,
  className = ''
}) => {
  const content = (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-4 ${className}`}>
      <div className="relative w-12 h-12 mb-4">
        <div className="w-12 h-12 rounded-full border-3 border-teal-100 border-t-teal-600 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-teal-600" />
        </div>
      </div>
      <h3 className="text-sm font-bold text-slate-800">{message}</h3>
      {subtext && <p className="text-xs text-slate-500 mt-1 max-w-xs">{subtext}</p>}
    </div>
  );

  if (card) {
    return <Card className="p-4 sm:p-6">{content}</Card>;
  }

  return content;
};
