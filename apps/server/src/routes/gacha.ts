import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { GachaType } from "@prisma/client";
import {
  HeroGachaPullRequestSchema,
  SparkRedeemRequestSchema,
  GetGachaHistoryQuerySchema,
} from "@arcade/protocol";
import { getActiveBanners } from "../services/banners.js";
import {
  getGachaStatus,
  pullHeroGacha,
  redeemSpark,
  getGachaHistory,
} from "../services/gacha.js";

const gachaRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================================
  // BANNERS
  // ============================================================================

  // GET /v1/gacha/banners - Get active banners for players
  fastify.get("/v1/gacha/banners", async (request, _reply) => {
    const querySchema = z.object({
      type: z.enum(["hero", "artifact"]).optional(),
    });

    const query = querySchema.safeParse(request.query);
    const gachaType = query.success && query.data.type
      ? query.data.type === "hero"
        ? GachaType.HERO
        : GachaType.ARTIFACT
      : undefined;

    const banners = await getActiveBanners(gachaType);

    // Transform to client format
    return {
      banners: banners.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        gachaType: b.gachaType.toLowerCase(),
        featuredItems: b.featuredItems,
        rateUpMultiplier: b.rateUpMultiplier,
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        isActive: b.isActive,
        priority: b.priority,
        imageUrl: b.imageUrl,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    };
  });

  // ============================================================================
  // GACHA STATUS
  // ============================================================================

  // GET /v1/gacha/status - Get user's gacha progress (pity, spark, shards)
  fastify.get("/v1/gacha/status", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const status = await getGachaStatus(request.userId);
    return status;
  });

  // ============================================================================
  // HERO GACHA PULLS
  // ============================================================================

  // POST /v1/gacha/pull/hero - Pull hero gacha
  fastify.post("/v1/gacha/pull/hero", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const bodySchema = HeroGachaPullRequestSchema.extend({
      bannerId: z.string().optional(),
    });

    let body;
    try {
      body = bodySchema.parse(request.body);
    } catch {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const result = await pullHeroGacha(
      request.userId,
      body.pullCount,
      body.bannerId,
    );

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
      });
    }

    return result;
  });

  // ============================================================================
  // SPARK REDEMPTION
  // ============================================================================

  // POST /v1/gacha/spark/redeem - Redeem spark for guaranteed hero
  fastify.post("/v1/gacha/spark/redeem", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    let body;
    try {
      body = SparkRedeemRequestSchema.parse(request.body);
    } catch {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const result = await redeemSpark(request.userId, body.heroId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
        remainingSpark: result.remainingSpark,
      });
    }

    return result;
  });

  // ============================================================================
  // GACHA HISTORY
  // ============================================================================

  // GET /v1/gacha/history - Get pull history
  fastify.get("/v1/gacha/history", async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    let query;
    try {
      query = GetGachaHistoryQuerySchema.parse(request.query);
    } catch {
      return reply.status(400).send({ error: "Invalid query parameters" });
    }

    const gachaType = query.gachaType
      ? query.gachaType === "hero"
        ? GachaType.HERO
        : GachaType.ARTIFACT
      : undefined;

    const history = await getGachaHistory(
      request.userId,
      gachaType,
      query.limit,
      query.offset,
    );

    return history;
  });
};

export default gachaRoutes;
