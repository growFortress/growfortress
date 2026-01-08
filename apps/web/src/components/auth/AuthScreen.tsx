import { authScreen, authLoading, authError } from '../../state/index.js';
import { LoginForm } from './LoginForm.js';
import { RegisterForm } from './RegisterForm.js';
import styles from './AuthScreen.module.css';

interface AuthScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string) => Promise<void>;
}

export function AuthScreen({ onLogin, onRegister }: AuthScreenProps) {
  const showLoginForm = () => {
    authScreen.value = 'login';
    authError.value = null;
  };

  const showRegisterForm = () => {
    authScreen.value = 'register';
    authError.value = null;
  };

  return (
    <div class={styles.authScreen}>
      <div class={styles.authBox}>
        <h1>Grow Fortress: Age of Super Hero</h1>
        <p>Tower defense roguelite z elementami arcade</p>

        {authScreen.value === 'login' ? (
          <>
            <LoginForm onSubmit={onLogin} />
            <div class={styles.authToggle} onClick={showRegisterForm}>
              Nie masz konta? <strong>Zarejestruj się</strong>
            </div>
          </>
        ) : (
          <>
            <RegisterForm onSubmit={onRegister} />
            <div class={styles.authToggle} onClick={showLoginForm}>
              Masz już konto? <strong>Zaloguj się</strong>
            </div>
          </>
        )}

        {authLoading.value && <div class={`${styles.loading} visible`}>Łączenie...</div>}
        {authError.value && <div class={styles.error}>{authError.value}</div>}
      </div>
    </div>
  );
}
