import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface VerificationBadgeProps {
  size?: number;
  className?: string;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({ size = 16, className }) => {
  return (
    <span className={cn('inline-flex items-center justify-center text-blue-500', className)} title="Verified">
      <BadgeCheck size={size} fill="currentColor" />
    </span>
  );
};
