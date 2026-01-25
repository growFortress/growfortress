/**
 * Mock auth plugin for integration tests
 * Always authenticates requests with a valid user
 * Does NOT verify tokens or check database - just extracts userId from token
 */
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    isAdmin?: boolean;
  }
  interface FastifyContextConfig {
    public?: boolean;
  }
}

const mockAuthPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("userId", undefined);
  fastify.decorateRequest("isAdmin", false);

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
          .send({ error: "Unauthorized" });
      }

      // In mock mode, extract userId from JWT payload (without cryptographic verification)
      // But we still validate that it's a well-formed JWT
      const token = authHeader.slice(7);

      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          return reply.status(401).send({ error: "Invalid or expired token" });
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (!payload.sub) {
          return reply.status(401).send({ error: "Invalid or expired token" });
        }
        request.userId = payload.sub;
      } catch {
        return reply.status(401).send({ error: "Invalid or expired token" });
      }

      // In test mode, we trust the token and don't check the database
      // Tests that need to check user role/banned status should mock the user lookup
      // in their individual test setup
      request.isAdmin = false;

      const isAdminRoute = request.url.startsWith("/admin");
      if (isAdminRoute) {
        return reply
          .status(403)
          .send({ error: "Forbidden: Admin access required" });
      }
    },
  );
};

export default fp(mockAuthPlugin, {
  name: "auth",
});
