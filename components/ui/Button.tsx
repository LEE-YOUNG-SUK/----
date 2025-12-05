import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantClass: Record<string, string> = {
  default: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm',
  primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400',
  outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100',
  ghost: 'text-gray-700 hover:bg-gray-100 active:bg-gray-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
};

const sizeClass: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

/**
 * 통합 버튼 컴포넌트
 * - variant: 버튼 스타일 (primary, secondary, danger 등)
 * - size: 버튼 크기 (sm, md, lg)
 * - loading: 로딩 상태 표시
 * - fullWidth: 전체 너비 사용
 */
export const Button = ({ 
  variant = 'default', 
  size = 'md', 
  loading = false,
  fullWidth = false,
  className = '', 
  disabled,
  children, 
  ...props 
}: ButtonProps) => {
  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-lg font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClass[variant] || variantClass.default}
        ${sizeClass[size] || sizeClass.md}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
          처리 중...
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
