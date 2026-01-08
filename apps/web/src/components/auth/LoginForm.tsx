import { useState } from 'preact/hooks';
import { authLoading } from '../../state/index.js';
import { Button } from '../shared/Button.js';
import styles from './AuthScreen.module.css';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<void>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const loading = authLoading.value;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    await onSubmit(username, password);
  };

  return (
    <form class={styles.authForm} onSubmit={handleSubmit}>
      <div class={styles.inputGroup}>
        <input
          type="text"
          placeholder="Nazwa gracza"
          required
          autocomplete="username"
          value={username}
          onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class={styles.inputGroup}>
        <input
          type="password"
          placeholder="Hasło"
          required
          autocomplete="current-password"
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
        />
      </div>
      <Button variant="primary" type="submit" disabled={loading} class={styles.authBtn}>
        Zaloguj się
      </Button>
    </form>
  );
}
