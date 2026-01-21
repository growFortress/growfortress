/**
 * Ensures all users have Progression records
 * Run with: npx tsx scripts/ensure-user-progression.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureUserProgression() {
  console.log('Starting user progression check...');

  try {
    // Find all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        progression: {
          select: { id: true },
        },
      },
    });

    console.log(`Found ${allUsers.length} total users`);

    // Filter users without progression
    const usersWithoutProgression = allUsers.filter((user) => !user.progression);

    console.log(`Found ${usersWithoutProgression.length} users without Progression records`);

    if (usersWithoutProgression.length === 0) {
      console.log('✅ All users already have Progression records!');
      return;
    }

    // Create progression records for users who don't have one
    let created = 0;
    for (const user of usersWithoutProgression) {
      try {
        await prisma.progression.create({
          data: {
            userId: user.id,
            level: 1,
            xp: 0,
            totalXp: 0,
            purchasedHeroSlots: 2,
            purchasedTurretSlots: 1,
          },
        });
        created++;
        console.log(`✅ Created Progression for user ${user.displayName} (${user.id})`);
      } catch (error) {
        console.error(`❌ Failed to create Progression for user ${user.displayName} (${user.id}):`, error);
      }
    }

    console.log(`\n✅ Successfully created ${created} Progression records`);
    console.log('🔄 Recommendation: Clear the leaderboard cache or restart the server to see updated data');
  } catch (error) {
    console.error('❌ Error during progression check:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

ensureUserProgression()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
