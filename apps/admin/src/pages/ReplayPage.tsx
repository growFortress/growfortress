import { useEffect, useState } from 'preact/hooks';
import { adminApi } from '../api/adminClient.js';
import { ReplayViewer } from '../components/ReplayViewer.js';

interface ReplayPageProps {
  id?: string; // runId or sessionId
  type?: string; // 'run' (default) or 'session'
  path?: string;
}

export function ReplayPage({ id, type = 'run' }: ReplayPageProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        let res;
        if (type === 'session') {
          res = await adminApi.getSessionReplayData(id);
        } else {
          res = await adminApi.getRunReplayData(id);
        }
        setData(res);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, type]);

  if (loading) return <div class="p-6">Loading replay data...</div>;
  if (error) return <div class="p-6 text-red-500">Error: {error}</div>;
  if (!data) return <div class="p-6">No data found</div>;

  return (
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold">Replay Viewer</h1>
          <p class="text-gray-400 text-sm">
            {type === 'session' ? 'Endless Session' : 'Standard Run'} ID: <span class="font-mono">{id}</span>
          </p>
        </div>
        <a 
          href="javascript:history.back()" 
          class="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
        >
          ← Back
        </a>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          {data.config ? (
            <ReplayViewer 
              seed={data.seed} 
              config={data.config} 
              events={data.events} 
            />
          ) : (
            <div class="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded text-yellow-500 text-sm">
              <p class="font-bold mb-1">Warning: Initial config missing</p>
              <p>Ta sesja została utworzona przed aktualizacją systemu replayów. Niektóre parametry mogą być niepoprawne (klasa twierdzy, bohaterowie).</p>
            </div>
          )}
        </div>

        <div class="space-y-6">
          <div class="bg-gray-800 p-4 rounded shadow">
            <h2 class="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Session Info</h2>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between"><span class="text-gray-400">Seed:</span> <span>{data.seed}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Events:</span> <span>{data.events.length}</span></div>
              {data.startingWave !== undefined && (
                <div class="flex justify-between"><span class="text-gray-400">Start Wave:</span> <span>{data.startingWave + 1}</span></div>
              )}
            </div>
          </div>

          <div class="bg-gray-800 p-4 rounded shadow">
            <h2 class="text-lg font-semibold mb-3 border-b border-gray-700 pb-2">Player Setup</h2>
            {data.config ? (
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-400">Class:</span> <span class="capitalize">{data.config.fortressClass}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">Heroes:</span> <span>{data.config.startingHeroes.join(', ') || 'None'}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">Turrets:</span> <span>{data.config.startingTurrets.map((t:any) => t.definitionId).join(', ') || 'None'}</span></div>
              </div>
            ) : (
              <p class="text-gray-500 italic text-xs">Setup data unavailable</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
