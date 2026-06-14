import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContextMenu from '@/app/components/ContextMenu';

describe('ContextMenu', () => {
  const actions = [
    { id: 'edit', label: 'Editar', icon: null, action: vi.fn() },
    { id: 'delete', label: 'Eliminar', icon: null, danger: true, action: vi.fn() },
  ];

  it('does not render when closed', () => {
    const { container } = render(<ContextMenu x={0} y={0} isOpen={false} onClose={vi.fn()} actions={actions} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders actions when open', () => {
    render(<ContextMenu x={100} y={200} isOpen={true} onClose={vi.fn()} actions={actions} />);
    expect(screen.getByText('Editar')).toBeDefined();
    expect(screen.getByText('Eliminar')).toBeDefined();
  });

  it('calls action and onClose on click', () => {
    const onClose = vi.fn();
    const action = { id: 'test', label: 'Test', icon: null, action: vi.fn() };
    render(<ContextMenu x={0} y={0} isOpen={true} onClose={onClose} actions={[action]} />);
    screen.getByText('Test').click();
    expect(action.action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} isOpen={true} onClose={onClose} actions={actions} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
