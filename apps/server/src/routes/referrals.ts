import { FastifyPluginAsync } from "fastify";
import { getReferralStatus } from "../services/referrals.js";

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
};

export default referralRoutes;
