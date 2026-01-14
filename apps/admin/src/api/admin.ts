import { adminToken, isAuthenticated } from "../hooks/useAuth";

const API_URL = import.meta.env.VITE_API_URL || "/api";

// Basic fetch wrapper
async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const token = adminToken.value;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}/admin${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      adminToken.value = null;
      isAuthenticated.value = false;
      throw new Error("Session expired. Please login again.");
    }

    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "API Error");
  }

  return response.json();
}

export interface PlayerSummary {
  id: string;
  username: string;
  displayName: string;
  role: "USER" | "ADMIN";
  banned: boolean;
  createdAt: string;
  lastIdleClaimAt: string;
}

export interface PlayerDetails extends PlayerSummary {
  inventory: any;
  progression: any;
  sessions: any[];
}

export interface PlayerListResponse {
  users: PlayerSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetId: string;
  details: any;
  createdAt: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getPlayers(
  page = 1,
  limit = 20,
  search = "",
): Promise<PlayerListResponse> {
  const query = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    search,
  });
  return fetchWithAuth(`/users?${query}`);
}

export async function getPlayer(id: string): Promise<PlayerDetails> {
  return fetchWithAuth(`/users/${id}`);
}

export async function banPlayer(
  id: string,
  banned: boolean,
): Promise<PlayerSummary> {
  return fetchWithAuth(`/users/${id}/ban`, {
    method: "POST",
    body: JSON.stringify({ banned }),
  });
}

export async function resetPlayer(id: string): Promise<any> {
  return fetchWithAuth(`/users/${id}/reset`, {
    method: "POST",
  });
}

export async function grantRewards(
  id: string,
  gold: number,
  dust: number,
): Promise<any> {
  return fetchWithAuth(`/users/${id}/grant`, {
    method: "POST",
    body: JSON.stringify({ gold, dust }),
  });
}

export async function getAuditLogs(
  page = 1,
  limit = 50,
): Promise<AuditLogResponse> {
  const query = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  return fetchWithAuth(`/audit-logs?${query}`);
}
