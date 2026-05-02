"use client";

import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  maxWidth?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, maxWidth = "max-w-2xl", children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-5 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-surface border border-border rounded-xl p-6 ${maxWidth} w-full max-h-[80vh] overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-text text-base font-bold">{title}</h3>
            <button
              onClick={onClose}
              className="text-muted hover:text-text text-xl bg-transparent border-none cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
