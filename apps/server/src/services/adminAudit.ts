import { prisma } from '../lib/prisma.js';

export async function createAuditLog(adminId: string, action: string, targetId: string, details: any = {}) {
  return prisma.auditLog.create({
    data: {
      adminId,
      action,
      targetId,
      details
    }
  });
}
