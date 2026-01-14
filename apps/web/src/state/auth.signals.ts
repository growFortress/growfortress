import { signal, Signal } from '@preact/signals';

// Auth state
export const isAuthenticated: Signal<boolean> = signal(false);
export const authLoading: Signal<boolean> = signal(false);
export const authError: Signal<string | null> = signal<string | null>(null);
export const authScreen: Signal<'login' | 'register' | 'forgot_password' | 'reset_password'> = signal<'login' | 'register' | 'forgot_password' | 'reset_password'>('login');
