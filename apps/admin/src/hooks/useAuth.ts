import { signal } from "@preact/signals";

// Auth state (memory only)
export const adminToken = signal<string | null>(null);
export const isAuthenticated = signal(false);

async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/v1/admin/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      adminToken.value = null;
      isAuthenticated.value = false;
      return false;
    }

    const data = await response.json();
    adminToken.value = data.accessToken;
    isAuthenticated.value = true;
    return true;
  } catch {
    adminToken.value = null;
    isAuthenticated.value = false;
    return false;
  }
}

export function useAuth() {
  const login = (token: string) => {
    adminToken.value = token;
    isAuthenticated.value = true;
  };

  const logout = async () => {
    try {
      await fetch("/api/v1/admin/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore logout failures
    }
    adminToken.value = null;
    isAuthenticated.value = false;
  };

  return {
    adminToken,
    isAuthenticated,
    login,
    logout,
    refreshSession,
  };
}
