import { prisma } from '../lib/prisma.js';
import { Simulation, getDefaultConfig } from '@arcade/sim-core';
import { applySimConfigSnapshot } from './simConfig.js';
import { getUnlockedPillarsForUser } from './pillarUnlocks.js';

const TICK_HZ = 30;

export async function getSessionStateAtTick(sessionId: string, targetTick: number) {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      segments: {
        orderBy: { startWave: 'asc' },
        where: { verified: true },
      },
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Initialize simulation with session config
  const config = getDefaultConfig();
  if (session.configJson) {
    applySimConfigSnapshot(config, session.configJson as any);
    
    // Fix: If snapshot doesn't have unlockedPillars (old sessions), use current fortress level
    if (!config.unlockedPillars) {
      config.unlockedPillars = await getUnlockedPillarsForUser(session.userId);
    }
  }
  config.startingWave = session.startingWave;
  config.tickHz = TICK_HZ;

  const sim = new Simulation(session.seed, config);

  // Flatten events from verified segments
  const events = session.segments.flatMap((s) => s.eventsJson as any[]);
  sim.setEvents(events);

  // Replay until target tick
  // We can optimize this by starting from the nearest verified checkpoint if we had them saved per tick
  // but for now, we replay from start of session (which is session.startingWave)
  while (sim.state.tick < targetTick && !sim.state.ended) {
    sim.step();
  }

  return sim.state;
}
