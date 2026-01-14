/**
 * Auth Routes Integration Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, generateTestToken } from "../../helpers/testApp.js";
import {
  mockPrisma,
  createMockUser,
  createMockSession,
  createMockInventory,
  createMockProgression,
  createMockRelicUnlock,
} from "../../mocks/prisma.js";
import bcrypt from "bcrypt";
import { vi } from "vitest";

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2b$12$hashed-password"),
    compare: vi.fn(),
  },
}));

describe("Auth Routes Integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /v1/auth/register", () => {
    it("should register a new user successfully", async () => {
      // Setup mocks
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const mockUser = createMockUser({ id: "new-user-123" });
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.session.create.mockResolvedValue(
        createMockSession({ userId: "new-user-123" }),
      );

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          username: "newuser",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.userId).toBeDefined();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeUndefined();

      const setCookie = response.headers["set-cookie"];
      const cookies = Array.isArray(setCookie)
        ? setCookie
        : setCookie
          ? [setCookie]
          : [];
      expect(
        cookies.some((cookie) => cookie.startsWith("arcade_refresh=")),
      ).toBe(true);
    });

    it("should reject registration with existing username", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser());

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          username: "existinguser",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject registration with invalid payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          username: "ab", // Too short
          password: "123", // Too short
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /v1/auth/login", () => {
    it("should login with valid credentials", async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      mockPrisma.session.create.mockResolvedValue(createMockSession());

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          username: "testuser",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeUndefined();

      const setCookie = response.headers["set-cookie"];
      const cookies = Array.isArray(setCookie)
        ? setCookie
        : setCookie
          ? [setCookie]
          : [];
      expect(
        cookies.some((cookie) => cookie.startsWith("arcade_refresh=")),
      ).toBe(true);
    });

    it("should reject login with invalid password", async () => {
      const mockUser = createMockUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          username: "testuser",
          password: "wrongpassword",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject login with non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          username: "nonexistent",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /v1/profile", () => {
    it("should return profile for authenticated user", async () => {
      const mockUser = createMockUser();
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression({ level: 5, xp: 500 });

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
        relicUnlocks: [createMockRelicUnlock("iron_will")],
      });

      const token = await generateTestToken("user-123");

      const response = await app.inject({
        method: "GET",
        url: "/v1/profile",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.displayName).toBe("TestUser");
      expect(body.progression.level).toBe(5);
      expect(body.progression.xp).toBe(500);
      expect(body.inventory.gold).toBe(100);
      expect(body.inventory.dust).toBe(50);
    });

    it("should reject request without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/profile",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject request with invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/profile",
        headers: {
          authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
