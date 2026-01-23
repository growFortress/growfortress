/**
 * Bug Reports service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBugReport, listBugReports, getBugReport } from '../../../services/bugReports.js';
import { mockPrisma } from '../../mocks/prisma.js';

describe('Bug Reports Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBugReport = {
    id: 'report-1',
    userId: 'user-123',
    sessionId: 'session-456',
    tick: 1500,
    description: 'Game crashed during wave 15',
    createdAt: new Date('2024-01-15T10:00:00Z'),
  };

  describe('createBugReport', () => {
    it('creates a bug report with all fields', async () => {
      mockPrisma.bugReport.create.mockResolvedValue(mockBugReport);

      const result = await createBugReport(
        'user-123',
        'session-456',
        1500,
        'Game crashed during wave 15'
      );

      expect(result).toEqual(mockBugReport);
      expect(mockPrisma.bugReport.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          sessionId: 'session-456',
          tick: 1500,
          description: 'Game crashed during wave 15',
        },
      });
    });
  });

  describe('listBugReports', () => {
    it('returns paginated bug reports with user info', async () => {
      const mockReports = [
        { ...mockBugReport, user: { username: 'testuser', displayName: 'Test User' } },
      ];
      mockPrisma.bugReport.findMany.mockResolvedValue(mockReports);
      mockPrisma.bugReport.count.mockResolvedValue(1);

      const result = await listBugReports(1, 20);

      expect(result).toEqual({
        reports: mockReports,
        total: 1,
        page: 1,
        totalPages: 1,
      });
      expect(mockPrisma.bugReport.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
      });
    });

    it('handles pagination correctly', async () => {
      mockPrisma.bugReport.findMany.mockResolvedValue([]);
      mockPrisma.bugReport.count.mockResolvedValue(100);

      const result = await listBugReports(3, 10);

      expect(result).toEqual({
        reports: [],
        total: 100,
        page: 3,
        totalPages: 10,
      });
      expect(mockPrisma.bugReport.findMany).toHaveBeenCalledWith({
        skip: 20, // (3-1) * 10
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('uses default pagination values', async () => {
      mockPrisma.bugReport.findMany.mockResolvedValue([]);
      mockPrisma.bugReport.count.mockResolvedValue(0);

      await listBugReports();

      expect(mockPrisma.bugReport.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('getBugReport', () => {
    it('returns bug report with user and session info', async () => {
      const mockReportWithDetails = {
        ...mockBugReport,
        user: {
          id: 'user-123',
          username: 'testuser',
          displayName: 'Test User',
        },
        session: {
          id: 'session-456',
          seed: '12345',
          startingWave: 1,
        },
      };
      mockPrisma.bugReport.findUnique.mockResolvedValue(mockReportWithDetails);

      const result = await getBugReport('report-1');

      expect(result).toEqual(mockReportWithDetails);
      expect(mockPrisma.bugReport.findUnique).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          session: true,
        },
      });
    });

    it('returns null for non-existent report', async () => {
      mockPrisma.bugReport.findUnique.mockResolvedValue(null);

      const result = await getBugReport('nonexistent');

      expect(result).toBeNull();
    });
  });
});
