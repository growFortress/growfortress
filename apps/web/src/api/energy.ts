/**
 * Energy System API
 *
 * Handles energy-related API calls for the premium economy system.
 */

import { request } from './base.js';
import type { EnergyStatus, RefillEnergyResponse } from '@arcade/protocol';

/**
 * Get current energy status for the authenticated user
 */
export async function getEnergy(): Promise<EnergyStatus> {
  return request<EnergyStatus>('/v1/energy');
}

/**
 * Refill energy using dust
 */
export async function refillEnergy(): Promise<RefillEnergyResponse> {
  return request<RefillEnergyResponse>('/v1/energy/refill', {
    method: 'POST',
  });
}
