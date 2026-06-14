import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, renderHook } from '@testing-library/react';
import { ToastProvider, useToast } from '@/app/contexts/ToastContext';

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws when useToast is used outside provider', () => {
    expect(() => renderHook(() => useToast())).toThrow('useToast must be used within ToastProvider');
  });

  it('adds a toast and it appears in the list', () => {
    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });
    act(() => result.current.addToast('success', 'Test message'));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('removes a toast after timeout', () => {
    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });
    act(() => result.current.addToast('error', 'Auto-remove'));
    expect(result.current.toasts).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('removes a toast manually', () => {
    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });
    act(() => result.current.addToast('info', 'Manual remove'));
    const id = result.current.toasts[0].id;
    act(() => result.current.removeToast(id));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('supports all toast types', () => {
    const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });
    act(() => result.current.addToast('success', 'S'));
    act(() => result.current.addToast('error', 'E'));
    act(() => result.current.addToast('info', 'I'));
    act(() => result.current.addToast('warning', 'W'));
    expect(result.current.toasts).toHaveLength(4);
  });
});
