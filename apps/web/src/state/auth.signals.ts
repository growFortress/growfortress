import { signal } from '@preact/signals';

// Auth state
export const isAuthenticated = signal(false);
export const authLoading = signal(false);
export const authError = signal<string | null>(null);
export const authScreen = signal<'login' | 'register'>('login');
