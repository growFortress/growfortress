import { useEffect, useState } from 'preact/hooks';
import { adminApi, PlayerDetails } from '../api/adminClient.js';
import { route } from 'preact-router';

export function PlayerDetailsPage({ id }: { id?: string; path?: string }) {
  const [player, setPlayer] = useState<PlayerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rewardForm, setRewardForm] = useState({ gold: 0, dust: 0 });

  const loadPlayer = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await adminApi.getPlayer(id);
      setPlayer(res);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayer();
  }, [id]);

  const toggleBan = async () => {
    if (!player) return;
    const confirmMsg = player.banned 
        ? `Are you sure you want to UNBAN ${player.displayName}?`
        : `Are you sure you want to BAN ${player.displayName}? This will revoke active sessions.`;
    
    if (!confirm(confirmMsg)) return;

    try {
      await adminApi.banPlayer(player.id, !player.banned);
      loadPlayer(); // Reload to get updated state
    } catch (e: any) {
      alert(e.message);
    }
  };

  const resetAccount = async () => {
    if (!player) return;
    if (!confirm(`DANGER: Are you sure you want to RESET ${player.displayName}? This will wipe level, xp, and inventory!`)) return;
    
    try {
      await adminApi.resetPlayer(player.id);
      loadPlayer();
      alert('Account reset successfully.');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const grantRewards = async (e: Event) => {
    e.preventDefault();
    if (!player) return;
    try {
        await adminApi.grantRewards(player.id, Number(rewardForm.gold), Number(rewardForm.dust));
        loadPlayer();
        setRewardForm({ gold: 0, dust: 0 });
        alert('Rewards granted!');
    } catch (e: any){
        alert(e.message);
    }
  };

  if (loading) return <div class="p-6">Loading...</div>;
  if (error) return <div class="p-6 text-red-600">Error: {error}</div>;
  if (!player) return <div class="p-6">Player not found</div>;

  return (
    <div class="p-6">
      <button onClick={() => route('/players')} class="mb-4 text-gray-500 hover:text-black">&larr; Back to Players</button>
      
      <div class="flex justify-between items-start mb-6">
        <div>
          <h1 class="text-3xl font-bold">{player.displayName}</h1>
          <div class="text-gray-500">@{player.username} • {player.id}</div>
          <div class="mt-2">
            <span class={`px-2 py-1 rounded text-sm font-bold ${player.banned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                {player.banned ? 'BANNED' : 'ACTIVE'}
            </span>
            <span class="ml-2 px-2 py-1 rounded text-sm bg-gray-100 text-gray-800">{player.role}</span>
          </div>
        </div>
        <div class="space-x-2">
            <button 
                onClick={toggleBan}
                class={`px-4 py-2 rounded font-bold text-white ${player.banned ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
                {player.banned ? 'Unban User' : 'Ban User'}
            </button>
            <button 
                onClick={resetAccount}
                class="px-4 py-2 rounded font-bold bg-gray-600 text-white hover:bg-gray-700"
            >
                Reset Progress
            </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inventory & Stats */}
        <div class="bg-white p-6 rounded shadow">
            <h2 class="text-xl font-bold mb-4">Progression</h2>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <div class="text-gray-500 text-sm">Level</div>
                    <div class="text-2xl font-mono">{player.progression.level}</div>
                </div>
                <div>
                    <div class="text-gray-500 text-sm">XP</div>
                    <div class="text-2xl font-mono">{player.progression.xp} / {player.progression.totalXp}</div>
                </div>
                <div>
                    <div class="text-gray-500 text-sm">Highest Wave</div>
                    <div class="text-2xl font-mono">{player.highestWave}</div>
                </div>
            </div>

            <h2 class="text-xl font-bold mt-6 mb-4">Inventory</h2>
            <div class="grid grid-cols-3 gap-4">
                <div class="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <div class="text-yellow-800 text-sm font-bold">Gold</div>
                    <div class="text-xl">{player.inventory.gold}</div>
                </div>
                <div class="bg-purple-50 p-3 rounded border border-purple-200">
                    <div class="text-purple-800 text-sm font-bold">Dust</div>
                    <div class="text-xl">{player.inventory.dust}</div>
                </div>
                <div class="bg-blue-50 p-3 rounded border border-blue-200">
                    <div class="text-blue-800 text-sm font-bold">Sigils</div>
                    <div class="text-xl">{player.inventory.sigils}</div>
                </div>
            </div>
        </div>

        {/* Grant Rewards */}
        <div class="bg-white p-6 rounded shadow">
            <h2 class="text-xl font-bold mb-4">Grant Rewards</h2>
            <form onSubmit={grantRewards} class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Gold</label>
                    <input 
                        type="number" 
                        value={rewardForm.gold} 
                        onInput={(e) => setRewardForm({...rewardForm, gold: Number(e.currentTarget.value)})}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-black"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Dust</label>
                    <input 
                        type="number" 
                        value={rewardForm.dust} 
                        onInput={(e) => setRewardForm({...rewardForm, dust: Number(e.currentTarget.value)})}
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-black"
                    />
                </div>
                <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                    Grant Resources
                </button>
            </form>
        </div>
      </div>

      {/* Game History */}
      <div class="mt-8 space-y-6">
        <div class="bg-white p-6 rounded shadow">
            <h2 class="text-xl font-bold mb-4">Standard Runs</h2>
            {player.runs && player.runs.length > 0 ? (
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="text-gray-500 border-b">
                                <th class="pb-2 font-medium">Date</th>
                                <th class="pb-2 font-medium">Seed</th>
                                <th class="pb-2 font-medium">Max Waves</th>
                                <th class="pb-2 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            {player.runs.map(run => (
                                <tr key={run.id} class="hover:bg-gray-50">
                                    <td class="py-3 text-sm">{new Date(run.issuedAt).toLocaleString()}</td>
                                    <td class="py-3 font-mono text-xs">{run.seed}</td>
                                    <td class="py-3">{run.maxWaves}</td>
                                    <td class="py-3">
                                        <button 
                                            onClick={() => route(`/replay/${run.id}?type=run`)}
                                            class="text-blue-600 hover:text-blue-800 text-sm font-bold"
                                        >
                                            Watch Replay
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p class="text-gray-500 italic">No standard runs found</p>
            )}
        </div>

        <div class="bg-white p-6 rounded shadow">
            <h2 class="text-xl font-bold mb-4">Endless Sessions</h2>
            {player.gameSessions && player.gameSessions.length > 0 ? (
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="text-gray-500 border-b">
                                <th class="pb-2 font-medium">Start Date</th>
                                <th class="pb-2 font-medium">Current Wave</th>
                                <th class="pb-2 font-medium">Status</th>
                                <th class="pb-2 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            {player.gameSessions.map(session => (
                                <tr key={session.id} class="hover:bg-gray-50">
                                    <td class="py-3 text-sm">{new Date(session.startedAt).toLocaleString()}</td>
                                    <td class="py-3">{session.currentWave + 1}</td>
                                    <td class="py-3 text-xs">
                                        {session.endedAt ? (
                                            <span class="text-gray-500">Ended ({session.endReason})</span>
                                        ) : (
                                            <span class="text-green-600 font-bold">Active</span>
                                        )}
                                    </td>
                                    <td class="py-3">
                                        <button 
                                            onClick={() => route(`/replay/${session.id}?type=session`)}
                                            class="text-blue-600 hover:text-blue-800 text-sm font-bold"
                                        >
                                            Watch Replay
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p class="text-gray-500 italic">No endless sessions found</p>
            )}
        </div>
      </div>
    </div>
  );
}
