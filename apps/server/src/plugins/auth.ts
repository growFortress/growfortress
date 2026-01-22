import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { verifyAccessToken, verifyAdminAccessToken } from "../lib/tokens.js";
import { prisma } from "../lib/prisma.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    isAdmin?: boolean;
    isGuest?: boolean;
  }
  interface FastifyContextConfig {
    public?: boolean;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("userId", undefined);
  fastify.decorateRequest("isAdmin", false);
  fastify.decorateRequest("isGuest", false);

  fastify.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip auth for routes marked as public in route config
      if (request.routeOptions?.config?.public) {
        return;
      }

      // Skip auth for health endpoint
      if (request.url.startsWith("/health")) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply
          .status(401)
          .send({ error: "Missing authorization header" });
      }

      const token = authHeader.slice(7);
      const isAdminRoute = request.url.startsWith("/admin");
      const payload = isAdminRoute
        ? await verifyAdminAccessToken(token)
        : await verifyAccessToken(token);

      if (!payload) {
        return reply.status(401).send({ error: "Invalid or expired token" });
      }

      request.userId = payload.sub;

      // Set isGuest from token payload (for non-admin routes only)
      if (!isAdminRoute && "isGuest" in payload) {
        request.isGuest = payload.isGuest === true;
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true, banned: true, isGuest: true },
      });

      if (!user) {
        return reply.status(401).send({ error: "Invalid or expired token" });
      }

      if (user.banned) {
        return reply.status(403).send({ error: "User is banned" });
      }

      request.isAdmin = user.role === "ADMIN";

      // Set isGuest from database (more authoritative than token)
      request.isGuest = user.isGuest === true;

      if (isAdminRoute && !request.isAdmin) {
        return reply
          .status(403)
          .send({ error: "Forbidden: Admin access required" });
      }
    },
  );
};

export default fp(authPlugin, {
  name: "auth",
});
