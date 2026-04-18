import * as React from 'react';
import { cn } from '../lib/utils';

export interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: 'pink' | 'blue' | 'green';
}

export const NeonButton = React.forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, color = 'blue', ...props }, ref) => {
    const colorClasses = {
      pink: 'text-glass-pink border-glass-pink/50 hover:bg-glass-pink/10 hover:border-glass-pink rounded-lg',
      blue: 'text-glass-blue border-glass-blue/50 hover:bg-glass-blue/10 hover:border-glass-blue rounded-lg',
      green: 'text-glass-green border-glass-green/50 hover:bg-glass-green/10 hover:border-glass-green rounded-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'px-6 py-2 border text-[12px] uppercase font-semibold tracking-wider transition-all duration-300 cursor-pointer',
          colorClasses[color],
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    );
  }
);

NeonButton.displayName = 'NeonButton';
