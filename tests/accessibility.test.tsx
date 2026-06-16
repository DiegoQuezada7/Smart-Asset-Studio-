import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import EmptyState from '@/app/components/EmptyState';
import ConfirmModal from '@/app/components/ConfirmModal';
import ErrorBoundary from '@/app/components/ErrorBoundary';

afterEach(cleanup);

describe('EmptyState a11y', () => {
  it('has no axe violations in upload view', async () => {
    const { container } = render(<EmptyState view="upload" />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('has no axe violations in results view', async () => {
    const { container } = render(<EmptyState view="results" />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('has no axe violations in studio view', async () => {
    const { container } = render(<EmptyState view="studio" />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});

describe('ConfirmModal a11y', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <ConfirmModal
        isOpen={true}
        title="Test"
        message="Test message"
        confirmLabel="Confirmar"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('renders with proper dialog role', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Test"
        message="Test message"
        confirmLabel="Confirmar"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});

describe('ErrorBoundary a11y', () => {
  it('has no axe violations in error state', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
    consoleSpy.mockRestore();
  });
});

function ThrowError() {
  throw new Error('Test error');
}
