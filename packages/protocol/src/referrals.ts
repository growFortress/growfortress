import { z } from "zod";

export const ReferralRewardSchema = z.object({
  gold: z.number().int().min(0),
  dust: z.number().int().min(0),
});

export const ReferralStatusResponseSchema = z.object({
  referralCode: z.string(),
  inviteCount: z.number().int().min(0),
  rewards: z.object({
    inviter: ReferralRewardSchema,
    invitee: ReferralRewardSchema,
  }),
});

export type ReferralReward = z.infer<typeof ReferralRewardSchema>;
export type ReferralStatusResponse = z.infer<typeof ReferralStatusResponseSchema>;
