import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** 입력 필드 크기 */
  inputSize?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'px-2 py-1.5 text-sm',
  md: 'px-3 py-2 text-base',
  lg: 'px-4 py-3 text-lg',
};

/**
 * 통합 Input 컴포넌트
 * - CSS 변수 기반 일관된 스타일
 * - 에러 상태 지원
 * - 라벨 지원
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, inputSize = 'md', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-900 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-colors
            ${sizeClasses[inputSize]}
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
