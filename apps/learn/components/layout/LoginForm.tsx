'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/sign-in/username', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      if (res.ok) {
        router.push('/contents');
        router.refresh();
      } else {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message || 'Invalid username or passphrase');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 'clamp(14px, 2vh, 20px)',
        paddingTop: 'clamp(10px, 1.5vh, 16px)',
        borderTop: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label
          htmlFor="entrance-username"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink40)',
          }}
        >
          Username
        </label>
        <input
          id="entrance-username"
          name="username"
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          disabled={isLoading}
          style={{
            width: '100%',
            background: 'transparent',
            border: 0,
            borderBottom: '1px solid var(--line)',
            padding: '6px 0',
            fontFamily: 'var(--font-body)',
            fontSize: '13.5px',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label
          htmlFor="entrance-password"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10.5px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink40)',
          }}
        >
          Passphrase
        </label>
        <input
          id="entrance-password"
          name="password"
          type="password"
          placeholder="Enter passphrase"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={isLoading}
          style={{
            width: '100%',
            background: 'transparent',
            border: 0,
            borderBottom: '1px solid var(--line)',
            padding: '6px 0',
            fontFamily: 'var(--font-body)',
            fontSize: '13.5px',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
      </div>

      {error && (
        <div
          role="alert"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--px-red-ink)',
            marginTop: '4px',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !username.trim() || !password}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          width: '100%',
          background: 'var(--panel)',
          color: 'var(--panelInk)',
          border: '1px solid var(--line)',
          padding: '10px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          cursor: isLoading || !username.trim() || !password ? 'not-allowed' : 'pointer',
          opacity: isLoading || !username.trim() || !password ? 0.6 : 1,
          marginTop: '4px',
        }}
      >
        {isLoading ? 'Signing in\u2026' : 'Open the course \u2192'}
      </button>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--ink45)' }}>
        Private course &middot; Access by invitation
      </div>
    </form>
  );
}
