import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";

export const REFERRAL_REWARDS = {
  inviter: { gold: 500, dust: 20 },
  invitee: { gold: 300, dust: 10 },
} as const;

const MAX_CODE_ATTEMPTS = 5;
const REFERRAL_CODE_LENGTH_BYTES = 4;

function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function createReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomBytes(REFERRAL_CODE_LENGTH_BYTES).toString("hex").toUpperCase();
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) {
      return code;
    }
  }
  throw new Error("REFERRAL_CODE_GENERATION_FAILED");
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  if (user.referralCode) {
    return user.referralCode;
  }

  const referralCode = await createReferralCode();
  await prisma.user.update({
    where: { id: userId },
    data: { referralCode },
  });

  return referralCode;
}

export async function getReferralStatus(userId: string): Promise<{
  referralCode: string;
  inviteCount: number;
  rewards: typeof REFERRAL_REWARDS;
}> {
  const referralCode = await getOrCreateReferralCode(userId);
  const inviteCount = await prisma.user.count({
    where: { referredById: userId },
  });

  return {
    referralCode,
    inviteCount,
    rewards: REFERRAL_REWARDS,
  };
}

export async function applyReferralCode(
  inviteeId: string,
  referralCode: string,
): Promise<{ applied: boolean; reason?: string }> {
  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) {
    return { applied: false, reason: "EMPTY_CODE" };
  }

  const [invitee, inviter] = await Promise.all([
    prisma.user.findUnique({
      where: { id: inviteeId },
      select: { id: true, referredById: true },
    }),
    prisma.user.findUnique({
      where: { referralCode: normalizedCode },
      select: { id: true },
    }),
  ]);

  if (!invitee) {
    return { applied: false, reason: "INVITEE_NOT_FOUND" };
  }

  if (!inviter) {
    return { applied: false, reason: "INVALID_CODE" };
  }

  if (inviter.id === invitee.id) {
    return { applied: false, reason: "SELF_REFERRAL" };
  }

  if (invitee.referredById) {
    return { applied: false, reason: "ALREADY_REFERRED" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: invitee.id },
      data: { referredById: inviter.id },
    });

    await tx.inventory.update({
      where: { userId: inviter.id },
      data: {
        gold: { increment: REFERRAL_REWARDS.inviter.gold },
        dust: { increment: REFERRAL_REWARDS.inviter.dust },
      },
    });

    await tx.inventory.update({
      where: { userId: invitee.id },
      data: {
        gold: { increment: REFERRAL_REWARDS.invitee.gold },
        dust: { increment: REFERRAL_REWARDS.invitee.dust },
      },
    });
  });

  return { applied: true };
}
