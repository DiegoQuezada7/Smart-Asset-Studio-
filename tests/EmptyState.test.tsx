import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import EmptyState from '@/app/components/EmptyState';

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders upload view with action', () => {
    const fn = vi.fn();
    render(<EmptyState view="upload" onAction={fn} />);
    expect(screen.getByText('Arrastra y suelta imágenes aquí')).toBeDefined();
    expect(screen.getByText('Seleccionar Archivos')).toBeDefined();
    expect(screen.getByText('Compatible con PNG, JPG, WebP')).toBeDefined();
  });

  it('renders results view without action when no handler given', () => {
    render(<EmptyState view="results" />);
    expect(screen.getByText('Aún no hay resultados')).toBeDefined();
    expect(screen.queryByText('Ir a Mesa de Trabajo')).toBeNull();
  });

  it('renders results view with action', () => {
    const fn = vi.fn();
    render(<EmptyState view="results" onAction={fn} />);
    expect(screen.getByText('Ir a Mesa de Trabajo')).toBeDefined();
  });

  it('renders studio view', () => {
    render(<EmptyState view="studio" />);
    expect(screen.getByText('Lienzo vacío')).toBeDefined();
    expect(screen.getByText('Añade activos procesados o importa imágenes para comenzar')).toBeDefined();
  });

  it('renders settings view', () => {
    render(<EmptyState view="settings" />);
    expect(screen.getByText('Configuración')).toBeDefined();
    expect(screen.getByText('Personaliza tu flujo de trabajo de exportación')).toBeDefined();
  });

  it('calls onAction when button is clicked', () => {
    const fn = vi.fn();
    render(<EmptyState view="upload" onAction={fn} />);
    screen.getByRole('button', { name: 'Seleccionar Archivos' }).click();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not render action button when onAction is undefined', () => {
    render(<EmptyState view="settings" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
