import type {
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthRefreshResponse,
  ProfileResponse,
  RunStartResponse,
  RunFinishRequest,
  RunFinishResponse,
  LeaderboardResponse,
  SessionStartRequest,
  SessionStartResponse,
  SegmentSubmitRequest,
  SegmentSubmitResponse,
  PartialRewards,
  SessionEndResponse,
  CompleteOnboardingRequest,
  CompleteOnboardingResponse,
  UpgradeHeroRequest,
  UpgradeHeroResponse,
  UpgradeTurretRequest,
  UpgradeTurretResponse,
  UpdateLoadoutRequest,
  ArtifactsResponse,
  CraftArtifactRequest,
  CraftArtifactResponse,
  EquipArtifactRequest,
  EquipArtifactResponse,
  UnequipArtifactRequest,
  UnequipArtifactResponse,
  UseItemRequest,
  UseItemResponse,
  PowerSummaryResponse,
  UnlockHeroRequest,
  UnlockHeroResponse,
  UnlockTurretRequest,
  UnlockTurretResponse,
} from '@arcade/protocol';
import { CONFIG } from '../config.js';
import { getAccessToken, getRefreshToken, setTokens, setDisplayName, clearTokens } from './auth.js';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        return false;
      }

      const data: AuthRefreshResponse = await response.json();
      setTokens(data.accessToken, data.refreshToken);
      setDisplayName(data.displayName);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipAuthRefresh?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  retry = true
): Promise<T> {
  const url = `${CONFIG.API_URL}${path}`;

  const { skipAuth, skipAuthRefresh, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...fetchOptions.headers as Record<string, string>,
  };

  if (fetchOptions.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    // Try to refresh token on 401
    if (response.status === 401 && retry && !skipAuthRefresh) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return request<T>(path, options, false);
      }
    }

    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error || 'Request failed', data);
  }

  // Handle empty responses (204 No Content)
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) {
    return {} as T;
  }

  return response.json();
}

// Auth
export async function register(data: AuthRegisterRequest): Promise<AuthRegisterResponse> {
  const response = await request<AuthRegisterResponse>('/v1/auth/register', {   
    method: 'POST',
    body: JSON.stringify(data),
    skipAuth: true,
    skipAuthRefresh: true,
  });
  setTokens(response.accessToken, response.refreshToken);
  setDisplayName(response.displayName);
  return response;
}

export async function login(data: AuthLoginRequest): Promise<AuthLoginResponse> {
  const response = await request<AuthLoginResponse>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
    skipAuth: true,
    skipAuthRefresh: true,
  });
  setTokens(response.accessToken, response.refreshToken);
  setDisplayName(response.displayName);
  return response;
}

export async function refreshTokensApi(refreshToken: string): Promise<AuthRefreshResponse | null> {
  try {
    const response = await request<AuthRefreshResponse>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
      skipAuthRefresh: true,
    });
    setTokens(response.accessToken, response.refreshToken);
    setDisplayName(response.displayName);
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearTokens();
      return null;
    }
    throw error;
  }
}

export async function getProfile(): Promise<ProfileResponse> {
  return request<ProfileResponse>('/v1/profile');
}

export async function completeOnboarding(
  data: CompleteOnboardingRequest
): Promise<CompleteOnboardingResponse> {
  return request<CompleteOnboardingResponse>('/v1/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Runs
export async function startRun(): Promise<RunStartResponse> {
  return request<RunStartResponse>('/v1/runs/start', {
    method: 'POST',
  });
}

export async function finishRun(
  runId: string,
  payload: RunFinishRequest
): Promise<RunFinishResponse> {
  return request<RunFinishResponse>(`/v1/runs/${encodeURIComponent(runId)}/finish`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Leaderboard
export async function getLeaderboard(
  week?: string,
  limit = 10
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (week) params.set('week', week);
  params.set('limit', limit.toString());

  return request<LeaderboardResponse>(`/v1/leaderboards/weekly?${params}`);
}

// Re-export session types for backwards compatibility
export type {
  SessionStartRequest,
  SessionStartResponse,
  SegmentSubmitRequest,
  SegmentSubmitResponse,
  PartialRewards,
  SessionEndResponse,
  UpdateLoadoutRequest,
} from '@arcade/protocol';

export async function startSession(data: SessionStartRequest = {}): Promise<SessionStartResponse> {
  return request<SessionStartResponse>('/v1/sessions/start', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Active session response type
export interface ActiveSessionResponse {
  sessionId: string;
  currentWave: number;
  startedAt: string;
}

export async function getActiveSession(): Promise<ActiveSessionResponse | null> {
  try {
    return await request<ActiveSessionResponse>('/v1/sessions/active');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function submitSegment(
  sessionId: string,
  payload: SegmentSubmitRequest
): Promise<SegmentSubmitResponse> {
  return request<SegmentSubmitResponse>(`/v1/sessions/${encodeURIComponent(sessionId)}/segment`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function endSession(
  sessionId: string,
  reason?: string,
  partialRewards?: PartialRewards
): Promise<SessionEndResponse> {
  return request<SessionEndResponse>(`/v1/sessions/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
    body: JSON.stringify({ reason, partialRewards }),
  });
}

// Upgrades
export async function upgradeHero(data: UpgradeHeroRequest): Promise<UpgradeHeroResponse> {
  return request<UpgradeHeroResponse>('/v1/upgrades/hero', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function upgradeTurret(data: UpgradeTurretRequest): Promise<UpgradeTurretResponse> {
  return request<UpgradeTurretResponse>('/v1/upgrades/turret', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Auth - Logout
export function logout(): void {
  clearTokens();
}

// Profile - Update default loadout
export async function updateDefaultLoadout(data: UpdateLoadoutRequest): Promise<ProfileResponse> {
  return request<ProfileResponse>('/v1/profile/loadout', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Materials
export interface MaterialsResponse {
  materials: Record<string, number>;
  totalCount: number;
  uniqueCount: number;
}

export async function getMaterials(): Promise<MaterialsResponse> {
  return request<MaterialsResponse>('/v1/inventory/materials');
}

export async function addMaterials(
  materials: Record<string, number>
): Promise<{ success: boolean; materials: Record<string, number> }> {
  return request('/v1/inventory/materials/add', {
    method: 'POST',
    body: JSON.stringify({ materials }),
  });
}

export async function removeMaterials(
  materials: Record<string, number>
): Promise<{ success: boolean; materials: Record<string, number> }> {
  return request('/v1/inventory/materials/remove', {
    method: 'POST',
    body: JSON.stringify({ materials }),
  });
}

// Artifacts
export async function getArtifacts(): Promise<ArtifactsResponse> {
  return request<ArtifactsResponse>('/v1/artifacts');
}

export async function craftArtifact(data: CraftArtifactRequest): Promise<CraftArtifactResponse> {
  return request<CraftArtifactResponse>('/v1/artifacts/craft', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function equipArtifact(data: EquipArtifactRequest): Promise<EquipArtifactResponse> {
  return request<EquipArtifactResponse>('/v1/artifacts/equip', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function unequipArtifact(data: UnequipArtifactRequest): Promise<UnequipArtifactResponse> {
  return request<UnequipArtifactResponse>('/v1/artifacts/unequip', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function useItem(data: UseItemRequest): Promise<UseItemResponse> {
  return request<UseItemResponse>('/v1/items/use', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Power Upgrades API
export async function getPowerSummary(): Promise<PowerSummaryResponse> {
  return request<PowerSummaryResponse>('/v1/power');
}

// Hero & Turret Unlocking
export async function unlockHero(data: UnlockHeroRequest): Promise<UnlockHeroResponse> {
  return request<UnlockHeroResponse>('/v1/heroes/unlock', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function unlockTurret(data: UnlockTurretRequest): Promise<UnlockTurretResponse> {
  return request<UnlockTurretResponse>('/v1/turrets/unlock', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Idle Rewards
export interface PendingIdleRewardsResponse {
  hoursOffline: number;
  cappedHours: number;
  pendingMaterials: Record<string, number>;
  pendingDust: number;
  canClaim: boolean;
  minutesUntilNextClaim: number;
}

export interface ClaimIdleRewardsResponse {
  success: boolean;
  claimed?: {
    materials: Record<string, number>;
    dust: number;
  };
  newInventory?: {
    materials: Record<string, number>;
    dust: number;
  };
  error?: string;
}

export interface IdleRewardsConfigResponse {
  commanderLevel: number;
  maxAccrualHours: number;
  expectedMaterialsPerHour: number;
  expectedMaterialsMax: number;
  legendaryChance: number;
}

export async function getPendingIdleRewards(): Promise<PendingIdleRewardsResponse> {
  return request<PendingIdleRewardsResponse>('/v1/idle/pending');
}

export async function claimIdleRewards(): Promise<ClaimIdleRewardsResponse> {
  return request<ClaimIdleRewardsResponse>('/v1/idle/claim', {
    method: 'POST',
  });
}

export async function getIdleRewardsConfig(): Promise<IdleRewardsConfigResponse> {
  return request<IdleRewardsConfigResponse>('/v1/idle/config');
}

// Bulk Rewards
export interface BulkReward {
  id: string;
  title: string;
  description: string;
  type: string;
  value: string;
  createdAt: string;
  expiresAt: string | null;
}

export async function getBulkRewards(): Promise<BulkReward[]> {
  return request<BulkReward[]>('/v1/rewards');
}

export async function claimBulkReward(rewardId: string): Promise<{ success: boolean; rewardId: string }> {
  return request<{ success: boolean; rewardId: string }>(`/v1/rewards/${encodeURIComponent(rewardId)}/claim`, {
    method: 'POST',
  });
}
