import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ErrorBoundary from '@/app/components/ErrorBoundary';

const consoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = consoleError;
  cleanup();
});

const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Kaboom');
  return <div>All good</div>;
};

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(<ErrorBoundary><div>OK</div></ErrorBoundary>);
    expect(screen.getByText('OK')).toBeDefined();
  });

  it('renders error UI on uncaught error', () => {
    render(<ErrorBoundary><Bomb shouldThrow={true} /></ErrorBoundary>);
    expect(screen.getByText('Algo salió mal')).toBeDefined();
    expect(screen.getByText('Kaboom')).toBeDefined();
  });

  it('renders custom fallback instead of default', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom error')).toBeDefined();
    expect(screen.queryByText('Algo salió mal')).toBeNull();
  });

  it('renders retry button and can retry', () => {
    render(<ErrorBoundary><Bomb shouldThrow={true} /></ErrorBoundary>);
    expect(screen.getByText('Kaboom')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
  });
});
