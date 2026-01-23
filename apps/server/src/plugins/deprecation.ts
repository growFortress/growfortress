import { FastifyPluginAsync } from "fastify";

/**
 * Configuration for deprecated endpoints
 * 
 * @example
 * {
 *   '/v1/sessions/start': {
 *     version: 'v1',
 *     sunsetDate: '2026-07-23T00:00:00Z',
 *     migrationGuide: 'https://docs.example.com/migration/v1-to-v2',
 *     replacement: '/v2/sessions/start'
 *   }
 * }
 */
interface DeprecationConfig {
  /** API version being deprecated */
  version: string;
  /** RFC 3339 date when endpoint will be removed */
  sunsetDate: string;
  /** URL to migration guide */
  migrationGuide: string;
  /** New endpoint to use instead (optional) */
  replacement?: string;
}

/**
 * Registry of deprecated endpoints
 * 
 * Add endpoints here when they are marked for deprecation.
 * They will automatically get deprecation headers added to responses.
 */
const DEPRECATED_ENDPOINTS: Record<string, DeprecationConfig> = {
  // Example (uncomment when needed):
  // '/v1/sessions/start': {
  //   version: 'v1',
  //   sunsetDate: '2026-07-23T00:00:00Z',
  //   migrationGuide: 'https://docs.example.com/migration/v1-to-v2',
  //   replacement: '/v2/sessions/start'
  // }
};

/**
 * Deprecation plugin for Fastify
 * 
 * Automatically adds deprecation headers to responses for deprecated endpoints:
 * - Deprecation: true
 * - Sunset: <RFC 3339 date>
 * - Link: <migration guide>; rel="deprecation"
 * 
 * Also logs usage for monitoring purposes.
 */
export const deprecationPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onSend", async (request, reply, payload) => {
    // Extract path without query string
    const path = request.url.split("?")[0];
    const deprecation = DEPRECATED_ENDPOINTS[path];

    if (deprecation) {
      // Add deprecation headers per RFC 8594
      reply.header("Deprecation", "true");
      reply.header("Sunset", new Date(deprecation.sunsetDate).toUTCString());
      reply.header(
        "Link",
        `<${deprecation.migrationGuide}>; rel="deprecation"`,
      );

      // Log usage for monitoring
      fastify.log.warn(
        {
          endpoint: path,
          method: request.method,
          userId: (request as any).userId,
          userAgent: request.headers["user-agent"],
          ip: request.ip,
          version: deprecation.version,
          replacement: deprecation.replacement,
        },
        "Deprecated API endpoint accessed",
      );
    }

    return payload;
  });
};

export default deprecationPlugin;
