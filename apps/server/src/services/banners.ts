import { GachaType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface CreateBannerData {
  name: string;
  description?: string;
  gachaType: GachaType;
  featuredItems: string[];
  rateUpMultiplier?: number;
  startsAt: Date;
  endsAt: Date;
  priority?: number;
  imageUrl?: string;
}

export interface UpdateBannerData {
  name?: string;
  description?: string | null;
  gachaType?: GachaType;
  featuredItems?: string[];
  rateUpMultiplier?: number;
  startsAt?: Date;
  endsAt?: Date;
  isActive?: boolean;
  priority?: number;
  imageUrl?: string | null;
}

/**
 * Get all banners (for admin panel)
 */
export async function listAllBanners() {
  return prisma.gachaBanner.findMany({
    orderBy: [{ priority: "desc" }, { startsAt: "desc" }],
  });
}

/**
 * Get currently active banners (for players)
 * Returns banners that are enabled and within their scheduled time window
 */
export async function getActiveBanners(gachaType?: GachaType) {
  const now = new Date();

  return prisma.gachaBanner.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      ...(gachaType && { gachaType }),
    },
    orderBy: [{ priority: "desc" }, { startsAt: "desc" }],
  });
}

/**
 * Get a single banner by ID
 */
export async function getBannerById(id: string) {
  return prisma.gachaBanner.findUnique({
    where: { id },
  });
}

/**
 * Create a new banner
 */
export async function createBanner(data: CreateBannerData) {
  return prisma.gachaBanner.create({
    data: {
      name: data.name,
      description: data.description,
      gachaType: data.gachaType,
      featuredItems: data.featuredItems,
      rateUpMultiplier: data.rateUpMultiplier ?? 2.0,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      priority: data.priority ?? 0,
      imageUrl: data.imageUrl,
    },
  });
}

/**
 * Update an existing banner
 */
export async function updateBanner(id: string, data: UpdateBannerData) {
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.gachaType !== undefined) updateData.gachaType = data.gachaType;
  if (data.featuredItems !== undefined) updateData.featuredItems = data.featuredItems;
  if (data.rateUpMultiplier !== undefined) updateData.rateUpMultiplier = data.rateUpMultiplier;
  if (data.startsAt !== undefined) updateData.startsAt = data.startsAt;
  if (data.endsAt !== undefined) updateData.endsAt = data.endsAt;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;

  return prisma.gachaBanner.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Delete a banner
 */
export async function deleteBanner(id: string) {
  return prisma.gachaBanner.delete({
    where: { id },
  });
}

/**
 * Check if a banner is currently live
 */
export function isBannerLive(banner: {
  isActive: boolean;
  startsAt: Date;
  endsAt: Date;
}): boolean {
  const now = new Date();
  return banner.isActive && banner.startsAt <= now && banner.endsAt >= now;
}

/**
 * Get rate-up multiplier for a featured item in an active banner
 * Returns 1.0 if not featured, or the banner's rateUpMultiplier if featured
 */
export async function getFeaturedRateUp(
  itemId: string,
  gachaType: GachaType,
): Promise<number> {
  const activeBanners = await getActiveBanners(gachaType);

  for (const banner of activeBanners) {
    if (banner.featuredItems.includes(itemId)) {
      return banner.rateUpMultiplier;
    }
  }

  return 1.0;
}
