/**
 * Slot Purchase API Client
 */

import { request } from './base.js';
import type { PurchaseHeroSlotResponse, PurchaseTurretSlotResponse, SlotStatus } from '@arcade/protocol';

/**
 * Purchase the next available hero slot
 */
export async function purchaseHeroSlot(): Promise<PurchaseHeroSlotResponse> {
  return request<PurchaseHeroSlotResponse>('/v1/slots/hero/purchase', {
    method: 'POST',
  });
}

/**
 * Purchase the next available turret slot
 */
export async function purchaseTurretSlot(): Promise<PurchaseTurretSlotResponse> {
  return request<PurchaseTurretSlotResponse>('/v1/slots/turret/purchase', {
    method: 'POST',
  });
}

/**
 * Get current slot status
 */
export async function getSlotStatus(): Promise<SlotStatus> {
  return request<SlotStatus>('/v1/slots/status');
}
