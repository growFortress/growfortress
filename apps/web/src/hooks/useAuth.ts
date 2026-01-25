import { useCallback } from "preact/hooks";
import {
  login,
  register,
  logout,
  createGuestSession,
} from "../api/client.js";
import {
  isAuthenticated as isAuthSignal,
  authError,
  authLoading,
  setGuestMode,
  clearGuestMode,
} from "../state/index.js";
import { useTranslation } from "../i18n/useTranslation.js";

export interface UseAuthResult {
  handleLogin: (username: string, password: string) => Promise<void>;
  handleRegister: (username: string, password: string) => Promise<void>;
  handleGuestLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
}

/**
 * Hook for authentication operations.
 * Extracts auth handling logic from App.tsx.
 */
export function useAuth(
  onAuthSuccess: () => void,
): UseAuthResult {
  const { t } = useTranslation(["auth"]);

  const handleLogin = useCallback(async (username: string, password: string): Promise<void> => {
    authLoading.value = true;
    authError.value = null;

    try {
      await login({ username, password });
      onAuthSuccess();
    } catch (error) {
      if (error instanceof Error && "status" in error) {
        const status = (error as { status: number }).status;
        if (status === 401) {
          authError.value = t("errors.invalidCredentials");
        } else if (status === 403) {
          authError.value = t("errors.accountBanned");
        } else if (status === 400) {
          authError.value = t("errors.invalidUsernameFormat");
        } else {
          authError.value = t("errors.connectionFailed");
        }
      } else {
        authError.value = t("errors.connectionFailed");
      }
      authLoading.value = false;
    }
  }, [onAuthSuccess, t]);

  const handleRegister = useCallback(async (username: string, password: string): Promise<void> => {
    authLoading.value = true;
    authError.value = null;

    try {
      await register({ username, password });
      onAuthSuccess();
    } catch (error) {
      if (
        error instanceof Error &&
        "status" in error &&
        (error as { status: number }).status === 400
      ) {
        authError.value = t("errors.registrationFailed");
      } else if (
        error instanceof Error &&
        error.message.includes("Validation")
      ) {
        authError.value = t("errors.validationError");
      } else {
        authError.value = t("errors.connectionFailed");
      }
      authLoading.value = false;
    }
  }, [onAuthSuccess, t]);

  const handleGuestLogin = useCallback(async (): Promise<void> => {
    authLoading.value = true;
    authError.value = null;

    try {
      await createGuestSession();
      setGuestMode(true);
      onAuthSuccess();
    } catch {
      authError.value = t("errors.connectionFailed");
      authLoading.value = false;
    }
  }, [onAuthSuccess, t]);

  const handleLogout = useCallback(async (): Promise<void> => {
    await logout();
    isAuthSignal.value = false;
    clearGuestMode();
  }, []);

  return {
    handleLogin,
    handleRegister,
    handleGuestLogin,
    handleLogout,
  };
}
