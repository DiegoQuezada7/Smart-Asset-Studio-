"use client";

import { useEffect, useCallback } from 'react';

type Shortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
  enabled?: boolean;
};

export function useKeyboard(shortcuts: Shortcut[]) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    for (const s of shortcuts) {
      if (s.enabled === false) continue;

      const ctrlOrMeta = s.ctrl || s.meta;
      const matchCtrl = ctrlOrMeta ? (e.ctrlKey || e.metaKey) : true;
      const matchShift = s.shift ? e.shiftKey : !e.shiftKey;
      const matchKey = e.key.toLowerCase() === s.key.toLowerCase() ||
                       e.code.toLowerCase() === s.key.toLowerCase();

      if (matchKey && matchCtrl && matchShift) {
        const target = e.target as HTMLElement;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
          continue;
        }
        e.preventDefault();
        s.handler();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
