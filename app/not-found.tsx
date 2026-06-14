import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-app, #0c0b0a)', color: 'var(--text-main, #f0ece6)',
      fontFamily: 'var(--font-body, system-ui)', gap: '1rem', padding: '2rem',
    }}>
      <h1 style={{
        fontFamily: 'var(--font-heading, Georgia, serif)', fontSize: '5rem',
        fontWeight: 300, color: 'var(--primary, #c9603c)', margin: 0, lineHeight: 1,
      }}>
        404
      </h1>
      <p style={{ fontSize: '1.1rem', color: 'var(--text-muted, #a0988e)', margin: 0, textAlign: 'center' }}>
        Esta página no existe.
      </p>
      <Link href="/" style={{
        marginTop: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: 8,
        background: 'var(--primary, #c9603c)', color: '#fff', textDecoration: 'none',
        fontFamily: 'inherit', fontSize: '0.9rem', transition: 'opacity 0.15s',
      }}>
        Volver al inicio
      </Link>
    </div>
  );
}
