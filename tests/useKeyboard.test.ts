import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboard } from '@/app/hooks/useKeyboard';

describe('useKeyboard', () => {
  let handler: () => void;

  beforeEach(() => {
    handler = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fireKey(key: string, opts?: { ctrl?: boolean; meta?: boolean; shift?: boolean }) {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      ctrlKey: opts?.ctrl ?? false,
      metaKey: opts?.meta ?? false,
      shiftKey: opts?.shift ?? false,
      bubbles: true,
      cancelable: true,
    }));
  }

  it('calls handler on matching key', () => {
    renderHook(() => useKeyboard([{ key: 'a', handler }]));
    fireKey('a');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not call handler on non-matching key', () => {
    renderHook(() => useKeyboard([{ key: 'a', handler }]));
    fireKey('b');
    expect(handler).not.toHaveBeenCalled();
  });

  it('respects ctrl modifier', () => {
    renderHook(() => useKeyboard([{ key: 's', ctrl: true, handler }]));
    fireKey('s', { ctrl: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not fire ctrl shortcut without ctrl', () => {
    renderHook(() => useKeyboard([{ key: 's', ctrl: true, handler }]));
    fireKey('s');
    expect(handler).not.toHaveBeenCalled();
  });

  it('respects meta modifier (Cmd)', () => {
    renderHook(() => useKeyboard([{ key: 'k', meta: true, handler }]));
    fireKey('k', { meta: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('respects shift modifier', () => {
    renderHook(() => useKeyboard([{ key: 'P', shift: true, handler }]));
    fireKey('P', { shift: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('skips when enabled is false', () => {
    renderHook(() => useKeyboard([{ key: 'a', handler, enabled: false }]));
    fireKey('a');
    expect(handler).not.toHaveBeenCalled();
  });

  it('skips when target is an input element', () => {
    renderHook(() => useKeyboard([{ key: 'a', handler }]));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('handles multiple shortcuts', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    renderHook(() => useKeyboard([{ key: '1', handler: h1 }, { key: '2', handler: h2 }]));
    fireKey('1');
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).not.toHaveBeenCalled();
  });

  it('matches by code as fallback', () => {
    renderHook(() => useKeyboard([{ key: 'space', handler }]));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    expect(handler).toHaveBeenCalledOnce();
  });
});
