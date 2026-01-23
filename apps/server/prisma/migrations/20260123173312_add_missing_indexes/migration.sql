-- CreateIndex
CREATE INDEX "User_banned_idx" ON "User"("banned");

-- CreateIndex
CREATE INDEX "Guild_disbanded_idx" ON "Guild"("disbanded");

-- CreateIndex
CREATE INDEX "MessageParticipant_userId_deletedAt_idx" ON "MessageParticipant"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "PillarChallengeSession_pillarId_tier_verified_wavesCleared_endedAt_idx" ON "PillarChallengeSession"("pillarId", "tier", "verified", "wavesCleared", "endedAt");
