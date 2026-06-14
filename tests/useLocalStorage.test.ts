import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '@/app/hooks/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('persists value to localStorage on set', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    act(() => result.current[1]('new-value'));
    expect(JSON.parse(localStorage.getItem('test-key')!)).toBe('new-value');
  });

  it('reads existing value from localStorage', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('stored-value');
  });

  it('handles complex objects', () => {
    const obj = { a: 1, b: 'hello', c: [1, 2, 3] };
    const { result } = renderHook(() => useLocalStorage('obj-key', {}));
    act(() => result.current[1](obj));
    expect(JSON.parse(localStorage.getItem('obj-key')!)).toEqual(obj);
  });

  it('supports functional updates', () => {
    const { result } = renderHook(() => useLocalStorage('counter', 0));
    act(() => result.current[1]((prev: number) => prev + 1));
    expect(result.current[0]).toBe(1);
  });

  it('handles localStorage errors gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const { result } = renderHook(() => useLocalStorage('key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });
});
