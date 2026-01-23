import { useState } from 'preact/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/adminClient.js';

interface Banner {
  id: string;
  name: string;
  description: string | null;
  gachaType: 'HERO' | 'ARTIFACT';
  featuredItems: string[];
  rateUpMultiplier: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  priority: number;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export function BannersPage(_: { path?: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gachaType: 'HERO' as 'HERO' | 'ARTIFACT',
    featuredItems: '',
    rateUpMultiplier: 2.0,
    startsAt: '',
    endsAt: '',
    priority: 0,
    imageUrl: '',
  });

  const { data: banners = [], isLoading } = useQuery<Banner[]>({
    queryKey: ['banners'],
    queryFn: adminApi.getBanners,
  });

  const createBannerMutation = useMutation({
    mutationFn: adminApi.createBanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        gachaType: 'HERO',
        featuredItems: '',
        rateUpMultiplier: 2.0,
        startsAt: '',
        endsAt: '',
        priority: 0,
        imageUrl: '',
      });
    },
    onError: (error: any) => alert('Failed to create banner: ' + error.message),
  });

  const deleteBannerMutation = useMutation({
    mutationFn: adminApi.deleteBanner,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] }),
    onError: (error: any) => alert('Failed to delete banner: ' + error.message),
  });

  const updateBannerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateBanner(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] }),
    onError: (error: any) => alert('Failed to update banner: ' + error.message),
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const featuredItems = formData.featuredItems
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (featuredItems.length === 0) {
      alert('Please enter at least one featured item ID');
      return;
    }

    createBannerMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      gachaType: formData.gachaType,
      featuredItems,
      rateUpMultiplier: formData.rateUpMultiplier,
      startsAt: new Date(formData.startsAt).toISOString(),
      endsAt: new Date(formData.endsAt).toISOString(),
      priority: formData.priority,
      imageUrl: formData.imageUrl || undefined,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this banner?')) {
      deleteBannerMutation.mutate(id);
    }
  };

  const toggleActive = (bannerId: string, currentActive: boolean) => {
    updateBannerMutation.mutate({ id: bannerId, data: { isActive: !currentActive } });
  };

  if (isLoading) return <div class="p-8 text-center text-gray-500">Loading banners...</div>;

  return (
    <div class="p-4 md:p-8 space-y-6">
      <header class="flex justify-between items-center">
        <h1 class="text-3xl font-bold text-gray-900 font-outfit">Gacha Banners</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition shadow-sm"
        >
          {showForm ? 'Cancel' : 'Create Banner'}
        </button>
      </header>

      {showForm && (
        <div class="bg-white p-6 rounded-xl shadow border border-gray-100 max-w-2xl">
          <h2 class="text-xl font-bold mb-4">New Banner</h2>
          <form onSubmit={handleSubmit} class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Banner Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onInput={(e) => setFormData({...formData, name: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Legendary Storm Banner"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onInput={(e) => setFormData({...formData, description: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Tell players about this banner..."
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Gacha Type</label>
                <select
                  value={formData.gachaType}
                  onChange={(e) => setFormData({...formData, gachaType: e.currentTarget.value as 'HERO' | 'ARTIFACT'})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="HERO">Hero</option>
                  <option value="ARTIFACT">Artifact</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Rate-Up Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="10"
                  required
                  value={formData.rateUpMultiplier}
                  onInput={(e) => setFormData({...formData, rateUpMultiplier: Number(e.currentTarget.value)})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Featured Items (comma-separated IDs)</label>
                <input
                  type="text"
                  required
                  value={formData.featuredItems}
                  onInput={(e) => setFormData({...formData, featuredItems: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. storm, frost_unit, rift"
                />
                <p class="text-xs text-gray-500 mt-1">Enter hero IDs separated by commas</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Starts At</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.startsAt}
                  onInput={(e) => setFormData({...formData, startsAt: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Ends At</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.endsAt}
                  onInput={(e) => setFormData({...formData, endsAt: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.priority}
                  onInput={(e) => setFormData({...formData, priority: Number(e.currentTarget.value)})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p class="text-xs text-gray-500 mt-1">Higher = shows first</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onInput={(e) => setFormData({...formData, imageUrl: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="https://..."
                />
              </div>
            </div>
            <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition">
              Create Banner
            </button>
          </form>
        </div>
      )}

      <div class="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <table class="w-full text-left">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Banner</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Type</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Featured</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Rate-Up</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Schedule</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {banners.map((banner) => {
              const now = new Date();
              const starts = new Date(banner.startsAt);
              const ends = new Date(banner.endsAt);
              const isLive = banner.isActive && now >= starts && now <= ends;
              const isScheduled = banner.isActive && now < starts;
              const isExpired = now > ends;

              return (
                <tr key={banner.id} class="hover:bg-gray-50 transition">
                  <td class="px-6 py-4">
                    <div class="font-bold text-gray-900">{banner.name}</div>
                    <div class="text-xs text-gray-500 truncate max-w-xs">{banner.description}</div>
                    <div class="text-xs text-gray-400">Priority: {banner.priority}</div>
                  </td>
                  <td class="px-6 py-4">
                    <span class={`px-2 py-1 text-[10px] font-bold rounded ring-1 ${
                      banner.gachaType === 'HERO'
                        ? 'bg-purple-100 text-purple-700 ring-purple-700/10'
                        : 'bg-amber-100 text-amber-700 ring-amber-700/10'
                    }`}>
                      {banner.gachaType}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1 max-w-xs">
                      {banner.featuredItems.slice(0, 3).map((item) => (
                        <span key={item} class="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded text-gray-600">
                          {item}
                        </span>
                      ))}
                      {banner.featuredItems.length > 3 && (
                        <span class="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded text-gray-600">
                          +{banner.featuredItems.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td class="px-6 py-4 font-mono font-bold text-indigo-600">x{banner.rateUpMultiplier}</td>
                  <td class="px-6 py-4 text-xs text-gray-500">
                    <div>S: {starts.toLocaleString()}</div>
                    <div>E: {ends.toLocaleString()}</div>
                  </td>
                  <td class="px-6 py-4">
                    {isLive ? (
                      <span class="px-2 py-1 text-[10px] font-bold rounded bg-green-100 text-green-700 animate-pulse">LIVE</span>
                    ) : isScheduled ? (
                      <span class="px-2 py-1 text-[10px] font-bold rounded bg-yellow-100 text-yellow-700">SCHEDULED</span>
                    ) : isExpired ? (
                      <span class="px-2 py-1 text-[10px] font-bold rounded bg-gray-100 text-gray-700">EXPIRED</span>
                    ) : (
                      <span class="px-2 py-1 text-[10px] font-bold rounded bg-red-100 text-red-700">DISABLED</span>
                    )}
                  </td>
                  <td class="px-6 py-4 space-x-2">
                    <button
                      onClick={() => toggleActive(banner.id, banner.isActive)}
                      class={`text-xs font-bold ${banner.isActive ? 'text-orange-600' : 'text-emerald-600'} hover:underline`}
                    >
                      {banner.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      class="text-xs font-bold text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {banners.length === 0 && (
              <tr>
                <td colspan={7} class="px-6 py-12 text-center text-gray-500 italic">
                  No banners found. Create your first one!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
