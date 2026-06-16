"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

interface ConfirmModalProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmación"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-active)",
          borderRadius: 16,
          padding: "2rem",
          maxWidth: 400,
          width: "90%",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          style={{
            color: "var(--text-main)",
            fontSize: "0.95rem",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {message}
        </p>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              background: "transparent",
              border: "1px solid var(--border-active)",
              color: "var(--text-muted)",
              padding: "0.5rem 1.25rem",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.9rem",
              minHeight: 44,
              touchAction: "manipulation",
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              background: danger ? "var(--danger-dim)" : "var(--primary-dim)",
              border: `1px solid ${danger ? "var(--danger)" : "var(--primary)"}`,
              color: danger ? "var(--danger)" : "var(--primary)",
              padding: "0.5rem 1.25rem",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.9rem",
              fontWeight: 600,
              minHeight: 44,
              touchAction: "manipulation",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
