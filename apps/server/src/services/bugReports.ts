import { prisma } from '../lib/prisma.js';

export async function createBugReport(userId: string, sessionId: string, tick: number, description: string) {
  return await prisma.bugReport.create({
    data: {
      userId,
      sessionId,
      tick,
      description,
    },
  });
}

export async function listBugReports(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [reports, total] = await Promise.all([
    prisma.bugReport.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.bugReport.count(),
  ]);

  return {
    reports,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getBugReport(id: string) {
  return await prisma.bugReport.findUnique({
    where: { id },
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
}
