import { useEffect, useState } from 'preact/hooks';
import { adminApi } from '../api/adminClient.js';
import { ReplayViewer } from '../components/ReplayViewer.js';

interface SessionDebuggerProps {
  sessionId?: string;
  path?: string;
}

export function SessionDebuggerPage({ sessionId }: SessionDebuggerProps) {
  const [sessionData, setSessionData] = useState<any>(null);
  const [debugState, setDebugState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [debugLoading, setDebugLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get params from URL (Preact Router doesn't always provide them in props for query params)
  const urlParams = new URLSearchParams(window.location.search);
  const initialTick = parseInt(urlParams.get('tick') || '0');
  const [currentTick, setCurrentTick] = useState(initialTick);

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return;
      setLoading(true);
      try {
        const res = await adminApi.getSessionReplayData(sessionId);
        setSessionData(res);
        setError(null);
        
        if (initialTick > 0) {
          fetchDebugState(initialTick);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [sessionId]);

  const fetchDebugState = async (tick: number) => {
    if (!sessionId) return;
    setDebugLoading(true);
    try {
      const state = await adminApi.getSessionStateAtTick(sessionId, tick);
      setDebugState(state);
      setCurrentTick(tick);
    } catch (e: any) {
      console.error(e);
    } finally {
      setDebugLoading(false);
    }
  };

  if (loading) return <div class="p-6">Loading session data...</div>;
  if (error) return <div class="p-6 text-red-500">Error: {error}</div>;
  if (!sessionData) return <div class="p-6">Session not found</div>;

  return (
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold">Session Debugger</h1>
          <p class="text-gray-400 text-sm">
            Session ID: <span class="font-mono">{sessionId}</span>
          </p>
        </div>
        <a 
          href="/bug-reports" 
          class="text-indigo-400 hover:text-indigo-300"
        >
          ← Back to Reports
        </a>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          <div class="bg-gray-800 p-4 rounded-lg shadow mb-6">
            <h2 class="text-lg font-semibold mb-4">Replay</h2>
            <ReplayViewer 
              seed={sessionData.seed} 
              config={sessionData.config} 
              events={sessionData.events} 
            />
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-gray-800 p-4 rounded-lg shadow">
            <div class="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
              <h2 class="text-lg font-semibold">State Inspector</h2>
              <button 
                onClick={() => fetchDebugState(currentTick)}
                class="text-xs bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded text-white"
                disabled={debugLoading}
              >
                {debugLoading ? 'Loading...' : 'Refresh State'}
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-xs text-gray-400 uppercase mb-1">Target Tick</label>
                <div class="flex gap-2">
                  <input 
                    type="number" 
                    value={currentTick}
                    onInput={(e) => setCurrentTick(parseInt(e.currentTarget.value))}
                    class="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-full text-sm"
                  />
                  <button 
                    onClick={() => fetchDebugState(currentTick)}
                    class="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm whitespace-nowrap"
                  >
                    Go
                  </button>
                </div>
              </div>

              {debugState ? (
                <div class="text-xs font-mono bg-black p-3 rounded border border-gray-700 overflow-auto max-h-[500px]">
                  <pre class="text-green-400">{JSON.stringify(debugState, null, 2)}</pre>
                </div>
              ) : (
                <div class="text-center py-10 text-gray-500 italic text-sm">
                  Select a tick and click 'Go' to inspect server-side simulation state.
                </div>
              )}
            </div>
          </div>

          <div class="bg-gray-800 p-4 rounded-lg shadow text-sm">
            <h3 class="font-semibold mb-2">Instructions</h3>
            <ul class="list-disc list-inside text-gray-400 space-y-1">
              <li>Use the slider to scrub through the replay visualizer.</li>
              <li>Enter a specific tick value to fetch the full simulation state from the server.</li>
              <li>The state inspector shows internal simulation variables including FP (Fixed Point) values.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
