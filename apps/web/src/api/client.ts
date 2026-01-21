import type {
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthRefreshResponse,
  ProfileResponse,
  LeaderboardResponse,
  SessionStartRequest,
  SessionStartResponse,
  SegmentSubmitRequest,
  SegmentSubmitResponse,
  PartialRewards,
  SessionEndResponse,
  ActiveSessionResponse,
  CompleteOnboardingRequest,
  CompleteOnboardingResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
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
  BuildPresetsUpdateRequest,
  BuildPreset,
  UpdateCurrencyRequest,
  UpdateCurrencyResponse,
  Currency,
  // Consolidated types from protocol
  MaterialsResponse,
  AddMaterialsResponse,
  RemoveMaterialsResponse,
  PendingIdleRewardsResponse,
  ClaimIdleRewardsResponse,
  UpgradeColonyRequest,
  UpgradeColonyResponse,
  IdleRewardsConfigResponse,
  BulkReward,
  ClaimBulkRewardResponse,
} from "@arcade/protocol";
import { setAuthData, clearTokens } from "./auth.js";
import { ApiError, request } from "./base.js";
import { resetAllState } from "../state/index.js";

// Re-export ApiError for backwards compatibility
export { ApiError } from "./base.js";

// Auth
export async function register(
  data: AuthRegisterRequest,
): Promise<AuthRegisterResponse> {
  const response = await request<AuthRegisterResponse>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
    skipAuth: true,
    skipAuthRefresh: true,
  });
  setAuthData(response.accessToken, response.userId, response.displayName);
  return response;
}

export async function forgotPassword(
  data: ForgotPasswordRequest,
): Promise<{ message: string }> {
  return request<{ message: string }>("/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(data),
    skipAuth: true,
    skipAuthRefresh: true,
  });
}

export async function resetPassword(
  data: ResetPasswordRequest,
): Promise<{ message: string }> {
  return request<{ message: string }>("/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(data),
    skipAuth: true,
    skipAuthRefresh: true,
  });
}

export async function login(
  data: AuthLoginRequest,
): Promise<AuthLoginResponse> {
  const response = await request<AuthLoginResponse>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
    skipAuth: true,
    skipAuthRefresh: true,
  });
  setAuthData(response.accessToken, response.userId, response.displayName);
  return response;
}

export async function refreshTokensApi(): Promise<AuthRefreshResponse | null> {
  try {
    const response = await request<AuthRefreshResponse>("/v1/auth/refresh", {
      method: "POST",
      skipAuth: true,
      skipAuthRefresh: true,
    });
    setAuthData(response.accessToken, undefined, response.displayName);
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
  return request<ProfileResponse>("/v1/profile");
}

export async function updatePreferredCurrency(
  currency: Currency,
): Promise<UpdateCurrencyResponse> {
  const payload: UpdateCurrencyRequest = { currency };
  return request<UpdateCurrencyResponse>("/v1/profile/currency", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function completeOnboarding(
  data: CompleteOnboardingRequest,
): Promise<CompleteOnboardingResponse> {
  return request<CompleteOnboardingResponse>("/v1/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Leaderboard
export async function getLeaderboard(
  week?: string,
  limit = 10,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (week) params.set("week", week);
  params.set("limit", limit.toString());

  return request<LeaderboardResponse>(`/v1/leaderboards/weekly?${params}`);
}

// Re-export types for backwards compatibility
export type {
  SessionStartRequest,
  SessionStartResponse,
  SegmentSubmitRequest,
  SegmentSubmitResponse,
  PartialRewards,
  SessionEndResponse,
  UpdateLoadoutRequest,
  // Materials
  MaterialsResponse,
  AddMaterialsResponse,
  RemoveMaterialsResponse,
  // Idle Rewards & Colonies
  PendingIdleRewardsResponse,
  ClaimIdleRewardsResponse,
  UpgradeColonyRequest,
  UpgradeColonyResponse,
  IdleRewardsConfigResponse,
  // Bulk Rewards
  BulkReward,
  ClaimBulkRewardResponse,
} from "@arcade/protocol";

export async function startSession(
  data: SessionStartRequest = {},
): Promise<SessionStartResponse> {
  return request<SessionStartResponse>("/v1/sessions/start", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getActiveSession(): Promise<ActiveSessionResponse | null> {
  try {
    return await request<ActiveSessionResponse>("/v1/sessions/active");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function submitSegment(
  sessionId: string,
  payload: SegmentSubmitRequest,
): Promise<SegmentSubmitResponse> {
  return request<SegmentSubmitResponse>(
    `/v1/sessions/${encodeURIComponent(sessionId)}/segment`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function endSession(
  sessionId: string,
  reason?: string,
  partialRewards?: PartialRewards,
): Promise<SessionEndResponse> {
  return request<SessionEndResponse>(
    `/v1/sessions/${encodeURIComponent(sessionId)}/end`,
    {
      method: "POST",
      body: JSON.stringify({ reason, partialRewards }),
    },
  );
}

// Upgrades
export async function upgradeHero(
  data: UpgradeHeroRequest,
): Promise<UpgradeHeroResponse> {
  return request<UpgradeHeroResponse>("/v1/upgrades/hero", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function upgradeTurret(
  data: UpgradeTurretRequest,
): Promise<UpgradeTurretResponse> {
  return request<UpgradeTurretResponse>("/v1/upgrades/turret", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Auth - Logout
export async function logout(): Promise<void> {
  try {
    await request<{ message?: string }>("/v1/auth/logout", {
      method: "POST",
      skipAuth: true,
      skipAuthRefresh: true,
    });
  } catch {
    // Ignore logout failures
  }

  // Clear all application state first
  resetAllState();
  // Then clear auth tokens
  clearTokens();
}

// Auth - Delete account
export async function deleteAccount(): Promise<boolean> {
  try {
    await request<void>("/v1/auth/account", {
      method: "DELETE",
    });

    // Clear all application state first
    resetAllState();
    // Then clear auth tokens
    clearTokens();

    return true;
  } catch {
    return false;
  }
}

// Profile - Get email
export async function getEmail(): Promise<string | null> {
  try {
    const response = await request<{ email: string | null }>("/v1/profile/email");
    return response.email;
  } catch {
    return null;
  }
}

// Profile - Update email
export async function updateEmail(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await request<{ email: string }>("/v1/profile/email", {
      method: "PATCH",
      body: JSON.stringify({ email }),
    });
    return { success: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update email" };
  }
}

// Auth - Change password
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await request<{ message: string }>("/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    // Password change revokes all sessions, so clear tokens
    resetAllState();
    clearTokens();

    return { success: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to change password" };
  }
}

// Bonus Code - Redeem
export interface BonusCodeRewards {
  gold: number;
  dust: number;
  energy: number;
  materials: Record<string, number>;
}

export async function redeemBonusCode(
  code: string,
): Promise<{ success: boolean; error?: string; rewards?: BonusCodeRewards }> {
  try {
    const response = await request<{
      message: string;
      rewards: BonusCodeRewards;
    }>("/v1/bonus-code/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    return { success: true, rewards: response.rewards };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to redeem code" };
  }
}

// Profile - Update default loadout
export async function updateDefaultLoadout(
  data: UpdateLoadoutRequest,
): Promise<ProfileResponse> {
  return request<ProfileResponse>("/v1/profile/loadout", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Profile - Update build presets
export async function updateBuildPresets(
  data: BuildPresetsUpdateRequest,
): Promise<{ buildPresets: BuildPreset[]; activePresetId: string | null }> {
  return request<{ buildPresets: BuildPreset[]; activePresetId: string | null }>(
    "/v1/profile/build-presets",
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

// Profile - Update player description
export async function updatePlayerDescription(
  description: string,
): Promise<{ description: string }> {
  return request<{ description: string }>("/v1/profile/description", {
    method: "PATCH",
    body: JSON.stringify({ description }),
  });
}

// Materials
export async function getMaterials(): Promise<MaterialsResponse> {
  return request<MaterialsResponse>("/v1/inventory/materials");
}

export async function addMaterials(
  materials: Record<string, number>,
): Promise<AddMaterialsResponse> {
  return request<AddMaterialsResponse>("/v1/inventory/materials/add", {
    method: "POST",
    body: JSON.stringify({ materials }),
  });
}

export async function removeMaterials(
  materials: Record<string, number>,
): Promise<RemoveMaterialsResponse> {
  return request<RemoveMaterialsResponse>("/v1/inventory/materials/remove", {
    method: "POST",
    body: JSON.stringify({ materials }),
  });
}

// Artifacts
export async function getArtifacts(): Promise<ArtifactsResponse> {
  return request<ArtifactsResponse>("/v1/artifacts");
}

export async function craftArtifact(
  data: CraftArtifactRequest,
): Promise<CraftArtifactResponse> {
  return request<CraftArtifactResponse>("/v1/artifacts/craft", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function equipArtifact(
  data: EquipArtifactRequest,
): Promise<EquipArtifactResponse> {
  return request<EquipArtifactResponse>("/v1/artifacts/equip", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function unequipArtifact(
  data: UnequipArtifactRequest,
): Promise<UnequipArtifactResponse> {
  return request<UnequipArtifactResponse>("/v1/artifacts/unequip", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function useItem(data: UseItemRequest): Promise<UseItemResponse> {
  return request<UseItemResponse>("/v1/items/use", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Power Upgrades API
export async function getPowerSummary(): Promise<PowerSummaryResponse> {
  return request<PowerSummaryResponse>("/v1/power");
}

// Hero & Turret Unlocking
export async function unlockHero(
  data: UnlockHeroRequest,
): Promise<UnlockHeroResponse> {
  return request<UnlockHeroResponse>("/v1/heroes/unlock", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function unlockTurret(
  data: UnlockTurretRequest,
): Promise<UnlockTurretResponse> {
  return request<UnlockTurretResponse>("/v1/turrets/unlock", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Idle Rewards
export async function getPendingIdleRewards(): Promise<PendingIdleRewardsResponse> {
  return request<PendingIdleRewardsResponse>("/v1/idle/pending");
}

export async function claimIdleRewards(): Promise<ClaimIdleRewardsResponse> {
  return request<ClaimIdleRewardsResponse>("/v1/idle/claim", {
    method: "POST",
  });
}

export async function getIdleRewardsConfig(): Promise<IdleRewardsConfigResponse> {
  return request<IdleRewardsConfigResponse>("/v1/idle/config");
}

export async function upgradeColony(
  data: UpgradeColonyRequest,
): Promise<UpgradeColonyResponse> {
  return request<UpgradeColonyResponse>("/v1/idle/colony/upgrade", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Bulk Rewards
export async function getBulkRewards(): Promise<BulkReward[]> {
  return request<BulkReward[]>("/v1/rewards");
}

export async function claimBulkReward(
  rewardId: string,
): Promise<ClaimBulkRewardResponse> {
  return request<ClaimBulkRewardResponse>(
    `/v1/rewards/${encodeURIComponent(rewardId)}/claim`,
    {
      method: "POST",
    },
  );
}
