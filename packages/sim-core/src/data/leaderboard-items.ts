/**
 * Exclusive items from leaderboard rankings
 * These items are awarded to top players in weekly rankings
 */

export type ExclusiveItemType = 'frame' | 'title' | 'badge' | 'aura' | 'effect';
export type ExclusiveItemRarity = 'rare' | 'epic' | 'legendary' | 'mythic';
export type ExclusiveItemCategory = 'waves' | 'honor';

export interface ExclusiveItem {
  id: string;
  name: string;
  polishName: string;
  description: string;
  type: ExclusiveItemType;
  rarity: ExclusiveItemRarity;
  category: ExclusiveItemCategory;
  icon: string;
  color: string;
  glowColor?: string;
  effect?: string;
}

// === WAVES LEADERBOARD ITEMS ===

export const WAVES_EXCLUSIVE_ITEMS: ExclusiveItem[] = [
  // TOP 1
  {
    id: 'waves_champion_frame',
    name: 'Champion Frame',
    polishName: 'Ramka Mistrza Fal',
    description: 'Zlota animowana ramka z falujacym efektem',
    type: 'frame',
    rarity: 'mythic',
    category: 'waves',
    icon: '👑',
    color: '#FFD700',
    glowColor: 'rgba(255, 215, 0, 0.6)',
    effect: 'wave-pulse',
  },
  {
    id: 'waves_champion_title',
    name: 'Wavebreaker',
    polishName: 'Pogromca Fal',
    description: 'Ekskluzywny tytul dla #1 w rankingu',
    type: 'title',
    rarity: 'mythic',
    category: 'waves',
    icon: '🌊',
    color: '#FFD700',
  },
  {
    id: 'waves_champion_aura',
    name: 'Golden Tide Aura',
    polishName: 'Aura Zlotej Fali',
    description: 'Zlota poswiata wokol awatara',
    type: 'aura',
    rarity: 'mythic',
    category: 'waves',
    icon: '✨',
    color: '#FFD700',
    effect: 'golden-tide',
  },

  // TOP 2
  {
    id: 'waves_silver_frame',
    name: 'Silver Wave Frame',
    polishName: 'Srebrna Ramka Fal',
    description: 'Srebrna ramka z subtelnym polyskiem',
    type: 'frame',
    rarity: 'legendary',
    category: 'waves',
    icon: '🥈',
    color: '#C0C0C0',
    glowColor: 'rgba(192, 192, 192, 0.5)',
  },
  {
    id: 'waves_silver_title',
    name: 'Tidemaster',
    polishName: 'Mistrz Przyplywu',
    description: 'Tytul dla drugiego miejsca',
    type: 'title',
    rarity: 'legendary',
    category: 'waves',
    icon: '🌊',
    color: '#C0C0C0',
  },

  // TOP 3
  {
    id: 'waves_bronze_frame',
    name: 'Bronze Wave Frame',
    polishName: 'Brazowa Ramka Fal',
    description: 'Brazowa ramka z cieplym blaskiem',
    type: 'frame',
    rarity: 'epic',
    category: 'waves',
    icon: '🥉',
    color: '#CD7F32',
  },
  {
    id: 'waves_bronze_badge',
    name: 'Wave Veteran',
    polishName: 'Weteran Fal',
    description: 'Odznaka dla podium',
    type: 'badge',
    rarity: 'epic',
    category: 'waves',
    icon: '🏅',
    color: '#CD7F32',
  },

  // TOP 4-10
  {
    id: 'waves_elite_badge',
    name: 'Elite Defender',
    polishName: 'Elitarny Obronca',
    description: 'Odznaka dla top 10 graczy',
    type: 'badge',
    rarity: 'rare',
    category: 'waves',
    icon: '🛡️',
    color: '#00BFFF',
  },

  // TOP 11-25
  {
    id: 'waves_veteran_badge',
    name: 'Wave Warrior',
    polishName: 'Wojownik Fal',
    description: 'Odznaka dla top 25 graczy',
    type: 'badge',
    rarity: 'rare',
    category: 'waves',
    icon: '⚔️',
    color: '#4169E1',
  },
];

// === HONOR (PVP) LEADERBOARD ITEMS ===

export const HONOR_EXCLUSIVE_ITEMS: ExclusiveItem[] = [
  // TOP 1
  {
    id: 'honor_gladiator_frame',
    name: 'Gladiator Frame',
    polishName: 'Ramka Gladiatora',
    description: 'Czerwono-zlota animowana ramka z plomieniami',
    type: 'frame',
    rarity: 'mythic',
    category: 'honor',
    icon: '🔥',
    color: '#FF4500',
    glowColor: 'rgba(255, 69, 0, 0.6)',
    effect: 'flame-dance',
  },
  {
    id: 'honor_gladiator_title',
    name: 'Supreme Gladiator',
    polishName: 'Najwyzszy Gladiator',
    description: 'Najwyzszy tytul areny',
    type: 'title',
    rarity: 'mythic',
    category: 'honor',
    icon: '⚔️',
    color: '#FF4500',
  },
  {
    id: 'honor_champion_effect',
    name: 'Arena Fire',
    polishName: 'Ogien Areny',
    description: 'Plonacy efekt wokol nazwy',
    type: 'effect',
    rarity: 'mythic',
    category: 'honor',
    icon: '🔥',
    color: '#FF4500',
    effect: 'arena-fire',
  },

  // TOP 2
  {
    id: 'honor_silver_frame',
    name: 'Silver Arena Frame',
    polishName: 'Srebrna Ramka Areny',
    description: 'Srebrna ramka z ostrzami',
    type: 'frame',
    rarity: 'legendary',
    category: 'honor',
    icon: '🗡️',
    color: '#C0C0C0',
  },
  {
    id: 'honor_duelist_title',
    name: 'Master Duelist',
    polishName: 'Mistrz Pojedynkow',
    description: 'Tytul dla drugiego miejsca',
    type: 'title',
    rarity: 'legendary',
    category: 'honor',
    icon: '⚔️',
    color: '#C0C0C0',
  },

  // TOP 3
  {
    id: 'honor_bronze_frame',
    name: 'Bronze Arena Frame',
    polishName: 'Brazowa Ramka Areny',
    description: 'Brazowa ramka z tarcza',
    type: 'frame',
    rarity: 'epic',
    category: 'honor',
    icon: '🛡️',
    color: '#CD7F32',
  },
  {
    id: 'honor_champion_badge',
    name: 'Arena Champion',
    polishName: 'Czempion Areny',
    description: 'Odznaka podium areny',
    type: 'badge',
    rarity: 'epic',
    category: 'honor',
    icon: '🏆',
    color: '#CD7F32',
  },

  // TOP 4-10
  {
    id: 'honor_elite_badge',
    name: 'Elite Fighter',
    polishName: 'Elitarny Wojownik',
    description: 'Odznaka dla top 10 areny',
    type: 'badge',
    rarity: 'rare',
    category: 'honor',
    icon: '💪',
    color: '#DC143C',
  },

  // TOP 11-25
  {
    id: 'honor_warrior_badge',
    name: 'Arena Warrior',
    polishName: 'Wojownik Areny',
    description: 'Odznaka dla top 25 areny',
    type: 'badge',
    rarity: 'rare',
    category: 'honor',
    icon: '⚔️',
    color: '#8B0000',
  },
];

// Combined list of all exclusive items
export const ALL_EXCLUSIVE_ITEMS: ExclusiveItem[] = [
  ...WAVES_EXCLUSIVE_ITEMS,
  ...HONOR_EXCLUSIVE_ITEMS,
];

// Helper to get item by ID
export function getExclusiveItemById(id: string): ExclusiveItem | undefined {
  return ALL_EXCLUSIVE_ITEMS.find(item => item.id === id);
}

// Helper to get items by category
export function getExclusiveItemsByCategory(category: ExclusiveItemCategory): ExclusiveItem[] {
  return ALL_EXCLUSIVE_ITEMS.filter(item => item.category === category);
}

// Helper to get items by rarity
export function getExclusiveItemsByRarity(rarity: ExclusiveItemRarity): ExclusiveItem[] {
  return ALL_EXCLUSIVE_ITEMS.filter(item => item.rarity === rarity);
}

// Reward tiers configuration
export interface RewardTier {
  maxRank: number;
  gold: number;
  dust: number;
  sigils: number;
  items: string[]; // Item IDs
}

export const WAVES_REWARD_TIERS: RewardTier[] = [
  { maxRank: 1, gold: 50000, dust: 500, sigils: 100, items: ['waves_champion_frame', 'waves_champion_title', 'waves_champion_aura'] },
  { maxRank: 2, gold: 35000, dust: 350, sigils: 70, items: ['waves_silver_frame', 'waves_silver_title'] },
  { maxRank: 3, gold: 25000, dust: 250, sigils: 50, items: ['waves_bronze_frame', 'waves_bronze_badge'] },
  { maxRank: 10, gold: 15000, dust: 150, sigils: 30, items: ['waves_elite_badge'] },
  { maxRank: 25, gold: 8000, dust: 80, sigils: 15, items: ['waves_veteran_badge'] },
  { maxRank: 50, gold: 4000, dust: 40, sigils: 5, items: [] },
  { maxRank: 100, gold: 2000, dust: 20, sigils: 0, items: [] },
];

export const HONOR_REWARD_TIERS: RewardTier[] = [
  { maxRank: 1, gold: 40000, dust: 400, sigils: 80, items: ['honor_gladiator_frame', 'honor_gladiator_title', 'honor_champion_effect'] },
  { maxRank: 2, gold: 28000, dust: 280, sigils: 55, items: ['honor_silver_frame', 'honor_duelist_title'] },
  { maxRank: 3, gold: 20000, dust: 200, sigils: 40, items: ['honor_bronze_frame', 'honor_champion_badge'] },
  { maxRank: 10, gold: 12000, dust: 120, sigils: 25, items: ['honor_elite_badge'] },
  { maxRank: 25, gold: 6000, dust: 60, sigils: 10, items: ['honor_warrior_badge'] },
  { maxRank: 50, gold: 3000, dust: 30, sigils: 5, items: [] },
];

export const REWARD_TIERS: Record<ExclusiveItemCategory, RewardTier[]> = {
  waves: WAVES_REWARD_TIERS,
  honor: HONOR_REWARD_TIERS,
};

// Get reward tier for a given rank and category
export function getRewardTierForRank(rank: number, category: ExclusiveItemCategory): RewardTier | null {
  const tiers = REWARD_TIERS[category];
  for (const tier of tiers) {
    if (rank <= tier.maxRank) {
      return tier;
    }
  }
  return null;
}
