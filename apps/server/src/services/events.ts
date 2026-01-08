import { prisma } from '../lib/prisma.js';

export async function getActiveMultipliers() {
  const now = new Date();
  const events = await prisma.scheduledEvent.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
  });

  const multipliers = {
    xp: 1.0,
    gold: 1.0,
    dust: 1.0,
  };

  for (const event of events) {
    if (event.type === 'MULTIPLIER_XP') {
      multipliers.xp *= event.value;
    } else if (event.type === 'MULTIPLIER_GOLD') {
      multipliers.gold *= event.value;
    } else if (event.type === 'MULTIPLIER_DUST') {
      multipliers.dust *= event.value;
    }
  }

  return multipliers;
}

export async function listAllEvents() {
  return prisma.scheduledEvent.findMany({
    orderBy: { startsAt: 'desc' },
  });
}

export async function createScheduledEvent(data: {
  name: string;
  description?: string;
  type: string;
  value: number;
  startsAt: Date;
  endsAt: Date;
}) {
  return prisma.scheduledEvent.create({
    data,
  });
}

export async function updateScheduledEvent(id: string, data: any) {
  return prisma.scheduledEvent.update({
    where: { id },
    data,
  });
}

export async function deleteScheduledEvent(id: string) {
  return prisma.scheduledEvent.delete({
    where: { id },
  });
}
