import { useEffect, useState } from 'preact/hooks';
import { adminApi } from '../api/adminClient.js';

export function BulkRewardsPage(_: { path?: string }) {
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'GOLD',
    value: '1000',
    expiresAt: '',
  });

  const fetchRewards = async () => {
    try {
      const data = await adminApi.getBulkRewards();
      setRewards(data);
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await adminApi.createBulkReward({
        ...formData,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
      });
      setShowForm(false);
      fetchRewards();
      setFormData({
        title: '',
        description: '',
        type: 'GOLD',
        value: '1000',
        expiresAt: '',
      });
    } catch (error) {
      alert('Failed to create reward: ' + error);
    }
  };

  if (loading) return <div class="p-8 text-center text-gray-500">Loading rewards...</div>;

  return (
    <div class="p-4 md:p-8 space-y-6">
      <header class="flex justify-between items-center">
        <h1 class="text-3xl font-bold text-gray-900 font-outfit">Bulk Rewards</h1>
        <button 
          onClick={() => setShowForm(!showForm)}
          class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition shadow-sm"
        >
          {showForm ? 'Cancel' : 'Create New Reward'}
        </button>
      </header>

      {showForm && (
        <div class="bg-white p-6 rounded-xl shadow border border-gray-100 max-w-2xl">
          <h2 class="text-xl font-bold mb-4">Send Bulk Reward</h2>
          <form onSubmit={handleSubmit} class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onInput={(e) => setFormData({...formData, title: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Compensation for Server Maintenance"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  required
                  value={formData.description}
                  onInput={(e) => setFormData({...formData, description: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Explain why players are receiving this reward..."
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Reward Type</label>
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="GOLD">Gold</option>
                  <option value="DUST">Dust</option>
                  <option value="SIGILS">Sigils</option>
                  <option value="ITEM">Item (itemId:amount)</option>
                  <option value="ARTIFACT">Artifact (artifactId)</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Value / ID</label>
                <input 
                  type="text" 
                  required
                  value={formData.value}
                  onInput={(e) => setFormData({...formData, value: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. 5000 or artifact_shield"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Expiration (Optional)</label>
                <input 
                  type="datetime-local" 
                  value={formData.expiresAt}
                  onInput={(e) => setFormData({...formData, expiresAt: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition">
              Distribute Reward
            </button>
          </form>
        </div>
      )}

      <div class="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <table class="w-full text-left">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Reward</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Type</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Value</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Created</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Expires</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {rewards.map((reward) => (
              <tr key={reward.id} class="hover:bg-gray-50 transition">
                <td class="px-6 py-4">
                  <div class="font-bold text-gray-900">{reward.title}</div>
                  <div class="text-xs text-gray-500">{reward.description}</div>
                </td>
                <td class="px-6 py-4">
                  <span class="px-2 py-1 text-[10px] font-bold rounded bg-purple-100 text-purple-700 border border-purple-200">
                    {reward.type}
                  </span>
                </td>
                <td class="px-6 py-4 font-mono font-bold text-indigo-600">{reward.value}</td>
                <td class="px-6 py-4 text-xs text-gray-500">
                  {new Date(reward.createdAt).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 text-xs text-gray-500">
                  {reward.expiresAt ? new Date(reward.expiresAt).toLocaleString() : 'Never'}
                </td>
              </tr>
            ))}
            {rewards.length === 0 && (
              <tr>
                <td colspan={5} class="px-6 py-12 text-center text-gray-500 italic">
                  No bulk rewards distributed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
