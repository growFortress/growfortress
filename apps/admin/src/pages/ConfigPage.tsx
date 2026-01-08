import { useEffect, useState } from 'preact/hooks';
import { adminApi } from '../api/adminClient.js';

export function ConfigPage(_: { path?: string }) {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getConfig();
      // Ensure defaults are visible even if not in DB
      const merged = {
        fortressBaseHp: 100,
        fortressBaseDamage: 10,
        waveIntervalTicks: 90,
        ...res
      };
      setConfig(merged);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleUpdate = async (key: string, value: any) => {
    setSaving(key);
    try {
      await adminApi.updateConfig(key, value);
      setConfig(prev => ({ ...prev, [key]: value }));
    } catch (e: any) {
      alert(`Failed to update ${key}: ${e.message}`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div class="p-6">Loading config...</div>;

  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">Remote Config</h1>
      <p class="text-gray-600 mb-6">Zdalna zmiana parametrów balansu gry. Zmiany wpływają na nowe sesje.</p>

      {error && <div class="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}

      <div class="grid gap-6 max-w-2xl">
        <ConfigItem 
          label="Base Fortress HP" 
          value={config.fortressBaseHp} 
          onSave={(v: string) => handleUpdate('fortressBaseHp', parseInt(v))}
          isSaving={saving === 'fortressBaseHp'}
          type="number"
        />
        <ConfigItem 
          label="Base Fortress Damage" 
          value={config.fortressBaseDamage} 
          onSave={(v: string) => handleUpdate('fortressBaseDamage', parseInt(v))}
          isSaving={saving === 'fortressBaseDamage'}
          type="number"
        />
        <ConfigItem 
          label="Wave Interval (Ticks)" 
          value={config.waveIntervalTicks} 
          onSave={(v: string) => handleUpdate('waveIntervalTicks', parseInt(v))}
          isSaving={saving === 'waveIntervalTicks'}
          type="number"
          description="30 ticks = 1 second"
        />
      </div>
    </div>
  );
}

function ConfigItem({ label, value, onSave, isSaving, type = 'text', description }: any) {
  const [val, setVal] = useState(value);

  return (
    <div class="bg-white p-4 rounded shadow">
      <div class="flex justify-between items-start mb-2">
        <label class="font-semibold text-gray-700">{label}</label>
        {description && <span class="text-xs text-gray-400">{description}</span>}
      </div>
      <div class="flex gap-2">
        <input 
          type={type} 
          value={val} 
          onInput={(e) => setVal(e.currentTarget.value)}
          class="flex-1 p-2 border rounded text-black"
        />
        <button 
          onClick={() => onSave(val)}
          disabled={isSaving || val == value}
          class="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
