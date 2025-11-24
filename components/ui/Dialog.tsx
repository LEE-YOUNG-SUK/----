import React from 'react';

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => onOpenChange?.(false)}
      />
      <div className="relative z-50">
        {children}
      </div>
    </div>
  );
};

export interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogContent = ({ children, className = '' }: DialogContentProps) => {
  return (
    <div className={`bg-white rounded-lg shadow-xl w-full ${className}`}>
      <div className="px-6 py-4">
        {children}
      </div>
    </div>
  );
};

export interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogHeader = ({ children, className = '' }: DialogHeaderProps) => {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
};

export interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogTitle = ({ children, className = '' }: DialogTitleProps) => {
  return (
    <h2 className={`text-xl font-semibold text-gray-900 ${className}`}>
      {children}
    </h2>
  );
};

export interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogFooter = ({ children, className = '' }: DialogFooterProps) => {
  return (
    <div className={`px-6 py-4 border-t border-gray-200 flex justify-end gap-2 ${className}`}>
      {children}
    </div>
  );
};

export default Dialog;
