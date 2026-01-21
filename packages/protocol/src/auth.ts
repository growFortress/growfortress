import { z } from "zod";
import { CurrencySchema } from "./shop.js";

// Username validation: 3-20 chars, alphanumeric and underscores
const usernameSchema = z
  .string()
  .min(3, "Nazwa musi mieć min. 3 znaki")
  .max(20, "Nazwa może mieć max. 20 znaków")
  .regex(/^[a-zA-Z0-9_]+$/, "Tylko litery, cyfry i podkreślenia");

// Password validation: min 6 chars
const passwordSchema = z
  .string()
  .min(6, "Hasło musi mieć min. 6 znaków")
  .max(100, "Hasło może mieć max. 100 znaków");

// Register
export const AuthRegisterRequestSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  email: z.string().email("Nieprawidłowy adres email").optional(),
});

export type AuthRegisterRequest = z.infer<typeof AuthRegisterRequestSchema>;

export const AuthRegisterResponseSchema = z.object({
  accessToken: z.string(),
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
  userId: z.string(),
  displayName: z.string(),
  expiresAt: z.number(),
});

export type AuthLoginResponse = z.infer<typeof AuthLoginResponseSchema>;

// Refresh token
export const AuthRefreshRequestSchema = z.object({
  refreshToken: z.string().optional(),
});

export type AuthRefreshRequest = z.infer<typeof AuthRefreshRequestSchema>;

export const AuthRefreshResponseSchema = z.object({
  accessToken: z.string(),
  displayName: z.string(),
  expiresAt: z.number(),
});

export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;

// Profile
export const InventorySchema = z.object({
  gold: z.number().int().min(0),
  dust: z.number().int().min(0),
  materials: z.record(z.string(), z.number()).optional(),
});

export type Inventory = z.infer<typeof InventorySchema>;

export const ProgressionSchema = z.object({
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
  totalXp: z.number().int().min(0),
  xpToNextLevel: z.number().int().min(0),
  purchasedHeroSlots: z.number().int().min(1).max(6).default(2),
  purchasedTurretSlots: z.number().int().min(1).max(6).default(1),
});

export type Progression = z.infer<typeof ProgressionSchema>;

// Fortress class types
export const FortressClassSchema = z.enum([
  "natural",
  "ice",
  "fire",
  "lightning",
  "tech",
  "void",
  "plasma",
]);
export type FortressClassType = z.infer<typeof FortressClassSchema>;

// Hero IDs (Unit IDs)
export const HeroIdSchema = z.enum([
  "storm",
  "forge",
  "titan",
  "vanguard",
  "rift",
  "frost",
  // Exclusive units:
  "spectre",
  "omega",
  // Future units:
  "spider_sentinel",
  "flame_phoenix",
  "venom_assassin",
  "arcane_sorcerer",
  "frost_giant",
  "cosmic_guardian",
]);
export type HeroIdType = z.infer<typeof HeroIdSchema>;

// Turret types (new Sci-Fi IDs with legacy aliases)
export const TurretTypeSchema = z.enum([
  "railgun",
  "artillery",
  "arc",
  "cryo", // Core turrets (new IDs)
  "arrow",
  "cannon",
  "tesla",
  "frost", // Legacy aliases (backwards compatibility)
  // Future turrets:
  "sniper",
  "flame",
  "support",
  "poison",
]);
export type TurretTypeType = z.infer<typeof TurretTypeSchema>;

// Default loadout schema
export const DefaultLoadoutSchema = z.object({
  fortressClass: FortressClassSchema.nullable(),
  heroId: HeroIdSchema.nullable(),
  turretType: TurretTypeSchema.nullable(),
});
export type DefaultLoadout = z.infer<typeof DefaultLoadoutSchema>;

// Build presets
export const BuildPresetSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(30),
  fortressClass: FortressClassSchema,
  startingHeroes: z.array(z.string()).max(6),
  startingTurrets: z.array(z.string()).max(6),
});
export type BuildPreset = z.infer<typeof BuildPresetSchema>;

export const BuildPresetsUpdateRequestSchema = z.object({
  buildPresets: z.array(BuildPresetSchema).max(5),
  activePresetId: z.string().nullable(),
});
export type BuildPresetsUpdateRequest = z.infer<
  typeof BuildPresetsUpdateRequestSchema
>;

// User role schema
export const UserRoleSchema = z.enum(["USER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

// Game config schema (server-side balance values)
export const GameConfigSchema = z.object({
  fortressBaseHp: z.number().int().min(1),
  fortressBaseDamage: z.number().int().min(1),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

export const ProfileResponseSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  description: z.string(),
  role: UserRoleSchema,
  country: z.string().nullable(),
  preferredCurrency: CurrencySchema,
  inventory: InventorySchema,
  progression: ProgressionSchema,
  currentWave: z.number().int().min(0),
  highestWave: z.number().int().min(0),
  // Onboarding status
  onboardingCompleted: z.boolean(),
  defaultLoadout: DefaultLoadoutSchema,
  buildPresets: z.array(BuildPresetSchema).max(5),
  activePresetId: z.string().nullable(),
  // Unlocked units
  unlockedHeroes: z.array(HeroIdSchema),
  unlockedTurrets: z.array(TurretTypeSchema),
  // Game config
  gameConfig: GameConfigSchema,
});

export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

// Update preferred currency
export const UpdateCurrencyRequestSchema = z.object({
  currency: CurrencySchema,
});
export type UpdateCurrencyRequest = z.infer<typeof UpdateCurrencyRequestSchema>;

export const UpdateCurrencyResponseSchema = z.object({
  preferredCurrency: CurrencySchema,
});
export type UpdateCurrencyResponse = z.infer<typeof UpdateCurrencyResponseSchema>;

// Complete onboarding request
export const CompleteOnboardingRequestSchema = z.object({
  fortressClass: FortressClassSchema,
  heroId: HeroIdSchema,
  turretType: TurretTypeSchema,
});

export type CompleteOnboardingRequest = z.infer<
  typeof CompleteOnboardingRequestSchema
>;

// Complete onboarding response
export const CompleteOnboardingResponseSchema = z.object({
  success: z.boolean(),
  defaultLoadout: DefaultLoadoutSchema,
});

export type CompleteOnboardingResponse = z.infer<
  typeof CompleteOnboardingResponseSchema
>;

// Password reset request
export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email("Nieprawidłowy adres email"),
});

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

// Password reset submission
export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
