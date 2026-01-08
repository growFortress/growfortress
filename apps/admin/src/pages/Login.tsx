import { useState } from 'preact/hooks';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }

      const data = await response.json();
      login(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🔐 Admin Login</h1>
        <p style={styles.subtitle}>Grow Fortress Administration</p>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              style={styles.input}
              required
            />
          </div>
          
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              style={styles.input}
              required
            />
          </div>
          
          {error && <div style={styles.error}>{error}</div>}
          
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
        
        <p style={styles.hint}>
          ⚠️ This panel is for authorized administrators only.
          All actions are logged.
        </p>
      </div>
    </div>
  );
}

import { JSX } from 'preact';

const styles: Record<string, JSX.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
  },
  card: {
    background: '#1a1a2e',
    border: '1px solid #00d9ff',
    borderRadius: '12px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 0 30px rgba(0, 217, 255, 0.2)',
  },
  title: {
    fontSize: '28px',
    marginBottom: '8px',
    textAlign: 'center' as const,
  },
  subtitle: {
    color: '#888',
    textAlign: 'center' as const,
    marginBottom: '30px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    color: '#00d9ff',
  },
  input: {
    padding: '12px',
    fontSize: '16px',
    border: '1px solid #333',
    borderRadius: '6px',
    background: '#0a0a0f',
    color: '#fff',
  },
  button: {
    padding: '14px',
    fontSize: '16px',
    fontWeight: 'bold',
    background: '#00d9ff',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '10px',
  },
  error: {
    background: 'rgba(255, 68, 68, 0.2)',
    border: '1px solid #ff4444',
    borderRadius: '6px',
    padding: '10px',
    color: '#ff4444',
    fontSize: '14px',
  },
  hint: {
    marginTop: '20px',
    fontSize: '12px',
    color: '#666',
    textAlign: 'center' as const,
  },
};
