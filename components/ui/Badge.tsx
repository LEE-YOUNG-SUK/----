import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}

const variantClass: Record<string, string> = {
  default: 'bg-blue-100 text-blue-800',
  secondary: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
};

export const Badge = ({ variant = 'default', className = '', children, ...props }: BadgeProps) => {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${variantClass[variant] || variantClass.default} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
