'use client'

import React, { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react';

// --- 드래그 컨텍스트 ---
interface DragContextType {
  onPointerDown: (e: React.PointerEvent) => void
}

const DialogDragContext = createContext<DragContextType | null>(null)

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const offsetSnap = useRef({ x: 0, y: 0 })
  const offsetRef = useRef({ x: 0, y: 0 })

  // 모달 열릴 때 위치 초기화
  useEffect(() => {
    if (open) {
      setOffset({ x: 0, y: 0 })
      offsetRef.current = { x: 0, y: 0 }
    }
  }, [open])

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange?.(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  // 드래그 이동/종료 이벤트 (document 레벨)
  useEffect(() => {
    if (!open) return

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      const newOffset = {
        x: offsetSnap.current.x + (e.clientX - dragStart.current.x),
        y: offsetSnap.current.y + (e.clientY - dragStart.current.y),
      }
      offsetRef.current = newOffset
      setOffset(newOffset)
    }

    const onUp = () => {
      dragging.current = false
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [open])

  // 드래그 시작 (DialogHeader에서 호출)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // 버튼/입력 등 인터랙티브 요소 클릭 시 드래그 방지
    const target = e.target as HTMLElement
    if (target.closest('button, input, select, textarea, a')) return

    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    offsetSnap.current = { ...offsetRef.current }
  }, [])

  if (!open) return null;

  return (
    <DialogDragContext.Provider value={{ onPointerDown }}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="fixed inset-0"
          onClick={(e) => {
            e.stopPropagation()
            onOpenChange?.(false)
          }}
        />
        <div
          className="relative z-50 w-full px-4"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        >
          {children}
        </div>
      </div>
    </DialogDragContext.Provider>
  );
};

export interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogContent = ({ children, className = '' }: DialogContentProps) => {
  const hasFlex = className.includes('flex');
  return (
    <div
      className={`bg-white rounded-lg shadow-xl border-2 border-gray-900 w-full mx-auto ${className}`}
      style={{ resize: 'both', overflow: 'auto', minWidth: 320, minHeight: 200 }}
    >
      <div className={`px-6 py-4${hasFlex ? ' flex flex-col flex-1 min-h-0 overflow-hidden' : ''}`}>
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
  const dragCtx = useContext(DialogDragContext)

  return (
    <div
      className={`px-6 py-4 border-b border-gray-200 cursor-grab active:cursor-grabbing select-none ${className}`}
      onPointerDown={dragCtx?.onPointerDown}
    >
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
