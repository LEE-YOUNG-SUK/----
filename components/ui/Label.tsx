import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

export const Label = ({ className = '', children, ...props }: LabelProps) => {
  return (
    <label
      className={`block text-sm font-medium text-gray-900 mb-1 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
};

export default Label;
