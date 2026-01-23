import type {
  GetActiveBannersResponse,
  GachaStatusResponse,
  HeroGachaPullResponse,
  SparkRedeemResponse,
  GetGachaHistoryResponse,
} from "@arcade/protocol";
import { request } from "./base.js";

/**
 * Get active gacha banners
 */
export async function getActiveBanners(
  type?: "hero" | "artifact",
): Promise<GetActiveBannersResponse> {
  const query = type ? `?type=${type}` : "";
  return request<GetActiveBannersResponse>(`/v1/gacha/banners${query}`);
}

/**
 * Get user's gacha status (pity, spark, shards)
 */
export async function getGachaStatus(): Promise<GachaStatusResponse> {
  return request<GachaStatusResponse>("/v1/gacha/status");
}

/**
 * Pull hero gacha
 */
export async function pullHeroGacha(
  pullCount: "single" | "ten",
  bannerId?: string,
): Promise<HeroGachaPullResponse> {
  return request<HeroGachaPullResponse>("/v1/gacha/pull/hero", {
    method: "POST",
    body: JSON.stringify({ pullCount, bannerId }),
  });
}

/**
 * Redeem spark for a guaranteed hero
 */
export async function redeemSpark(heroId: string): Promise<SparkRedeemResponse> {
  return request<SparkRedeemResponse>("/v1/gacha/spark/redeem", {
    method: "POST",
    body: JSON.stringify({ heroId }),
  });
}

/**
 * Get gacha pull history
 */
export async function getGachaHistory(
  gachaType?: "hero" | "artifact",
  limit = 50,
  offset = 0,
): Promise<GetGachaHistoryResponse> {
  const params = new URLSearchParams();
  if (gachaType) params.set("gachaType", gachaType);
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());

  return request<GetGachaHistoryResponse>(`/v1/gacha/history?${params}`);
}
