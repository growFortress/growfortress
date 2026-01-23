import { FastifyPluginAsync } from "fastify";
import { getReferralStatus, applyReferralCode } from "../services/referrals.js";
import { prisma } from "../lib/prisma.js";

const referralRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/referrals
   * Get referral code and invite stats for the current user
   */
  fastify.get("/v1/referrals", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const status = await getReferralStatus(request.userId);
    return reply.send(status);
  });

  /**
   * POST /v1/referrals/apply
   * Apply a referral code to the current user
   */
  fastify.post<{
    Body: { code: string };
  }>("/v1/referrals/apply", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { code } = request.body;
    if (!code || typeof code !== "string") {
      return reply.status(400).send({ error: "Invalid request", code: "INVALID_REQUEST" });
    }

    const result = await applyReferralCode(request.userId, code);

    if (!result.applied) {
      const statusCodes: Record<string, number> = {
        EMPTY_CODE: 400,
        INVALID_CODE: 404,
        SELF_REFERRAL: 400,
        ALREADY_REFERRED: 409,
        INVITEE_NOT_FOUND: 404,
      };
      const statusCode = statusCodes[result.reason || ""] || 400;
      return reply.status(statusCode).send({
        error: result.reason,
        code: result.reason,
      });
    }

    return reply.send({ applied: true });
  });

  /**
   * GET /v1/referrals/stats
   * Get detailed referral statistics for the current user
   */
  fastify.get("/v1/referrals/stats", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const status = await getReferralStatus(request.userId);

    // Get list of referred users
    const referredUsers = await prisma.user.findMany({
      where: { referredById: request.userId },
      select: {
        id: true,
        displayName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return reply.send({
      referralCode: status.referralCode,
      inviteCount: status.inviteCount,
      rewards: status.rewards,
      referredUsers: referredUsers.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        joinedAt: u.createdAt,
      })),
    });
  });
};

export default referralRoutes;
