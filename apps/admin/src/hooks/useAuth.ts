import { signal } from '@preact/signals';

// Auth state
export const adminToken = signal<string | null>(localStorage.getItem('adminToken'));
export const isAuthenticated = signal(!!adminToken.value);

export function useAuth() {
  const login = (token: string) => {
    localStorage.setItem('adminToken', token);
    adminToken.value = token;
    isAuthenticated.value = true;
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    adminToken.value = null;
    isAuthenticated.value = false;
  };

  return {
    adminToken,
    isAuthenticated,
    login,
    logout
  };
}
