import { z } from 'zod';

// Username validation: 3-20 chars, alphanumeric and underscores
const usernameSchema = z.string()
  .min(3, 'Nazwa musi mieć min. 3 znaki')
  .max(20, 'Nazwa może mieć max. 20 znaków')
  .regex(/^[a-zA-Z0-9_]+$/, 'Tylko litery, cyfry i podkreślenia');

// Password validation: min 6 chars
const passwordSchema = z.string()
  .min(6, 'Hasło musi mieć min. 6 znaków')
  .max(100, 'Hasło może mieć max. 100 znaków');

// Register
export const AuthRegisterRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export type AuthRegisterRequest = z.infer<typeof AuthRegisterRequestSchema>;

export const AuthRegisterResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  userId: z.string(),
  displayName: z.string(),
  expiresAt: z.number(),
});

export type AuthRegisterResponse = z.infer<typeof AuthRegisterResponseSchema>;

// Login
export const AuthLoginRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export type AuthLoginRequest = z.infer<typeof AuthLoginRequestSchema>;

export const AuthLoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  userId: z.string(),
  displayName: z.string(),
  expiresAt: z.number(),
});

export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>;

// Refresh token
export const AuthRefreshRequestSchema = z.object({
  refreshToken: z.string(),
});

export type AuthRefreshRequest = z.infer<typeof AuthRefreshRequestSchema>;

export const AuthRefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  displayName: z.string(),
  expiresAt: z.number(),
});

export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;

// Profile
export const InventorySchema = z.object({
  gold: z.number().int().min(0),
  dust: z.number().int().min(0),
  sigils: z.number().int().min(0),
});

export type Inventory = z.infer<typeof InventorySchema>;

export const ProgressionSchema = z.object({
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
  totalXp: z.number().int().min(0),
  xpToNextLevel: z.number().int().min(0),
});

export type Progression = z.infer<typeof ProgressionSchema>;

// Fortress class types
export const FortressClassSchema = z.enum([
  'natural', 'ice', 'fire', 'lightning', 'tech'
]);
export type FortressClassType = z.infer<typeof FortressClassSchema>;

// Hero IDs (starter heroes)
export const HeroIdSchema = z.enum([
  'thunderlord', 'iron_sentinel', 'jade_titan', 'spider_sentinel',
  'shield_captain', 'scarlet_mage', 'frost_archer', 'flame_phoenix',
  'venom_assassin', 'arcane_sorcerer', 'frost_giant', 'cosmic_guardian'
]);
export type HeroIdType = z.infer<typeof HeroIdSchema>;

// Turret types
export const TurretTypeSchema = z.enum([
  'arrow', 'cannon', 'sniper', 'tesla', 'frost', 'flame', 'support', 'poison'
]);
export type TurretTypeType = z.infer<typeof TurretTypeSchema>;

// Default loadout schema
export const DefaultLoadoutSchema = z.object({
  fortressClass: FortressClassSchema.nullable(),
  heroId: HeroIdSchema.nullable(),
  turretType: TurretTypeSchema.nullable(),
});
export type DefaultLoadout = z.infer<typeof DefaultLoadoutSchema>;

export const ProfileResponseSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  inventory: InventorySchema,
  progression: ProgressionSchema,
  currentWave: z.number().int().min(0),
  highestWave: z.number().int().min(0),
  // Onboarding status
  onboardingCompleted: z.boolean(),
  defaultLoadout: DefaultLoadoutSchema,
  // Unlocked units
  unlockedHeroes: z.array(HeroIdSchema),
  unlockedTurrets: z.array(TurretTypeSchema),
});

export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

// Complete onboarding request
export const CompleteOnboardingRequestSchema = z.object({
  fortressClass: FortressClassSchema,
  heroId: HeroIdSchema,
  turretType: TurretTypeSchema,
});

export type CompleteOnboardingRequest = z.infer<typeof CompleteOnboardingRequestSchema>;

// Complete onboarding response
export const CompleteOnboardingResponseSchema = z.object({
  success: z.boolean(),
  defaultLoadout: DefaultLoadoutSchema,
});

export type CompleteOnboardingResponse = z.infer<typeof CompleteOnboardingResponseSchema>;
