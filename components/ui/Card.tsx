import React from 'react';

// ============================================================
// 기본 Card 컴포넌트
// ============================================================

export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card = ({ children, className = '' }: CardProps) => {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader = ({ children, className = '' }: CardHeaderProps) => {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
};

export interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle = ({ children, className = '' }: CardTitleProps) => {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </h3>
  );
};

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent = ({ children, className = '' }: CardContentProps) => {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
};

// ============================================================
// ContentCard - 섹션/카드 wrapper 컴포넌트
// ============================================================

export interface ContentCardProps {
  children: React.ReactNode;
  title?: string;
  headerActions?: React.ReactNode;
  className?: string;
}

/**
 * 섹션/카드 wrapper 컴포넌트
 * - 흰 배경, 그림자, 둥근 모서리
 * - 선택적 제목과 헤더 액션 버튼 영역
 */
export const ContentCard = ({ 
  children, 
  title, 
  headerActions, 
  className = '' 
}: ContentCardProps) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {(title || headerActions) && (
        <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {headerActions && (
              <div className="flex items-center gap-2">
                {headerActions}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
};

// ============================================================
// StatCard - 통계 카드 컴포넌트
// ============================================================

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

/**
 * 통계 카드 컴포넌트
 * - 대시보드/레포트에서 주요 수치 표시용
 */
export const StatCard = ({
  label,
  value,
  unit,
  subtitle,
  icon,
  variant = 'default',
  className = ''
}: StatCardProps) => {
  const colorClass = {
    default: 'text-gray-900',
    primary: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-orange-600',
    danger: 'text-red-600',
  };

  return (
    <div className={`bg-white p-4 sm:p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs sm:text-sm text-gray-600">{label}</p>
        {icon && <span className="text-lg sm:text-xl">{icon}</span>}
      </div>
      <p className={`text-base sm:text-lg font-bold ${colorClass[variant]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-xs sm:text-sm ml-1">{unit}</span>}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
};

export default Card;
