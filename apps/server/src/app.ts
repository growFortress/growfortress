import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import cookie from "@fastify/cookie";
import { config } from "./config.js";

// Plugins
import authPlugin from "./plugins/auth.js";
import rateLimitPlugin from "./plugins/rateLimit.js";
import errorHandlerPlugin from "./plugins/errorHandler.js";
import responseTimePlugin from "./plugins/responseTime.js";
import websocketPlugin from "./plugins/websocket.js";
import deprecationPlugin from "./plugins/deprecation.js";

// Services
import { initWebSocketService } from "./services/websocket.js";

// Routes
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import sessionsRoutes from "./routes/sessions.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import telemetryRoutes from "./routes/telemetry.js";
import upgradesRoutes from "./routes/upgrades.js";
import materialsRoutes from "./routes/materials.js";
import artifactsRoutes from "./routes/artifacts.js";
import powerUpgradesRoutes from "./routes/power-upgrades.js";
import heroesRoutes from "./routes/heroes.js";
import idleRoutes from "./routes/idle.js";
import bulkRewardsRoutes from "./routes/bulkRewards.js";
import bossRushRoutes from "./routes/boss-rush.js";
import pvpRoutes from "./routes/pvp.js";
import guildRoutes from "./routes/guilds.js";
import messagesRoutes from "./routes/messages.js";
import moderationRoutes from "./routes/moderation.js";
import { adminRoutes } from "./routes/admin.js";
import { bugReportRoutes } from "./routes/bugReports.js";
import iapRoutes from "./routes/iap.js";
import pillarChallengeRoutes from "./routes/pillarChallenge.js";
import masteryRoutes from "./routes/mastery.js";
import dailyQuestsRoutes from "./routes/dailyQuests.js";
import hubPreviewRoutes from "./routes/hubPreview.js";
import guildPreviewRoutes from "./routes/guildPreview.js";
import shopRoutes from "./routes/shop.js";
import slotsRoutes from "./routes/slots.js";
import energyRoutes from "./routes/energy.js";
import pillarUnlocksRoutes from "./routes/pillarUnlocks.js";
import battlepassRoutes from "./routes/battlepass.js";
import { supportTicketRoutes } from "./routes/supportTickets.js";
import referralRoutes from "./routes/referrals.js";
import gachaRoutes from "./routes/gacha.js";

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === "development" ? "debug" : "info",
    },
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
  });

  // Add raw body support for Stripe webhooks
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      // Store raw body for webhook signature verification
      (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
      try {
        const json = JSON.parse(body.toString());
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // Register CORS with explicit allowed origins
  const allowedOrigins = config.CORS_ORIGINS.split(",").map((o) => o.trim());
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (health checks, mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }
      // Check if origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Reject other origins
      callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  });

  // Response compression (30-50% bandwidth reduction)
  await fastify.register(compress, {
    global: true,
    encodings: ["gzip", "deflate"],
    threshold: 1024, // Only compress responses > 1KB
  });

  // Cookie parsing (refresh tokens)
  await fastify.register(cookie, {
    secret: config.JWT_SECRET,
  });

  // Security headers
  fastify.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "1; mode=block");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header(
      "Permissions-Policy",
      "geolocation=(), camera=(), microphone=()",
    );
    if (config.NODE_ENV === "production") {
      reply.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
      reply.header(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self';",
      );
    }
  });

  // Security headers
  fastify.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "1; mode=block");
    if (config.NODE_ENV === "production") {
      reply.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }
  });

  // Register plugins
  await fastify.register(errorHandlerPlugin);
  await fastify.register(responseTimePlugin);
  await fastify.register(authPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(deprecationPlugin);
  await fastify.register(websocketPlugin);

  // Initialize WebSocket service with fastify instance
  initWebSocketService(fastify);

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(sessionsRoutes);
  await fastify.register(leaderboardRoutes);
  await fastify.register(telemetryRoutes);
  await fastify.register(upgradesRoutes);
  await fastify.register(materialsRoutes);
  await fastify.register(artifactsRoutes);
  await fastify.register(powerUpgradesRoutes);
  await fastify.register(heroesRoutes);
  await fastify.register(idleRoutes);
  await fastify.register(bulkRewardsRoutes);
  await fastify.register(bossRushRoutes);
  await fastify.register(pvpRoutes);
  await fastify.register(guildRoutes);
  await fastify.register(messagesRoutes);
  await fastify.register(moderationRoutes);
  await fastify.register(bugReportRoutes);
  await fastify.register(iapRoutes);
  await fastify.register(pillarChallengeRoutes);
  await fastify.register(masteryRoutes);
  await fastify.register(dailyQuestsRoutes);
  await fastify.register(hubPreviewRoutes);
  await fastify.register(guildPreviewRoutes);
  await fastify.register(shopRoutes);
  await fastify.register(slotsRoutes);
  await fastify.register(energyRoutes);
  await fastify.register(pillarUnlocksRoutes);
  await fastify.register(battlepassRoutes);
  await fastify.register(supportTicketRoutes);
  await fastify.register(referralRoutes);
  await fastify.register(gachaRoutes);

  // Admin routes (separate auth system)
  await fastify.register(adminRoutes, { prefix: "/admin" });

  return fastify;
}
