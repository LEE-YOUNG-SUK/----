import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  /** Textarea 크기 */
  textareaSize?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'px-2 py-1.5 text-sm min-h-[60px]',
  md: 'px-3 py-2 text-base min-h-[80px]',
  lg: 'px-4 py-3 text-lg min-h-[120px]',
};

/**
 * 통합 Textarea 컴포넌트
 * - CSS 변수 기반 일관된 스타일
 * - 에러 상태 지원
 * - 라벨 지원
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', label, error, textareaSize = 'md', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            resize-vertical transition-colors
            ${sizeClasses[textareaSize]}
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

Textarea.displayName = 'Textarea';

export default Textarea;
