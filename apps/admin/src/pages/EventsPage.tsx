import { useState } from 'preact/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/adminClient.js';

export function EventsPage(_: { path?: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'MULTIPLIER_XP',
    value: 2.0,
    startsAt: '',
    endsAt: '',
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: adminApi.getEvents,
  });

  const createEventMutation = useMutation({
    mutationFn: adminApi.createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        type: 'MULTIPLIER_XP',
        value: 2.0,
        startsAt: '',
        endsAt: '',
      });
    },
    onError: (error: any) => alert('Failed to create event: ' + error.message),
  });

  const deleteEventMutation = useMutation({
    mutationFn: adminApi.deleteEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
    onError: (error: any) => alert('Failed to delete event: ' + error.message),
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateEvent(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
    onError: (error: any) => alert('Failed to update event: ' + error.message),
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    createEventMutation.mutate({
      ...formData,
      startsAt: new Date(formData.startsAt).toISOString(),
      endsAt: new Date(formData.endsAt).toISOString(),
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure?')) {
      deleteEventMutation.mutate(id);
    }
  };

  const toggleActive = (eventId: string, currentActive: boolean) => {
    updateEventMutation.mutate({ id: eventId, data: { isActive: !currentActive } });
  };

  if (isLoading) return <div class="p-8 text-center text-gray-500">Loading events...</div>;

  return (
    <div class="p-4 md:p-8 space-y-6">
      <header class="flex justify-between items-center">
        <h1 class="text-3xl font-bold text-gray-900 font-outfit">Event Manager</h1>
        <button 
          onClick={() => setShowForm(!showForm)}
          class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition shadow-sm"
        >
          {showForm ? 'Cancel' : 'Create Event'}
        </button>
      </header>

      {showForm && (
        <div class="bg-white p-6 rounded-xl shadow border border-gray-100 max-w-2xl">
          <h2 class="text-xl font-bold mb-4">New Event</h2>
          <form onSubmit={handleSubmit} class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onInput={(e) => setFormData({...formData, name: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Double XP Weekend"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  value={formData.description}
                  onInput={(e) => setFormData({...formData, description: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Tell players about the event..."
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.currentTarget.value})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="MULTIPLIER_XP">XP Multiplier</option>
                  <option value="MULTIPLIER_GOLD">Gold Multiplier</option>
                  <option value="MULTIPLIER_DUST">Dust Multiplier</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Multiplier Value</label>
                <input 
                  type="number" 
                  step="0.1"
                  required
                  value={formData.value}
                  onInput={(e) => setFormData({...formData, value: Number(e.currentTarget.value)})}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
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
            </div>
            <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition">
              Launch Event
            </button>
          </form>
        </div>
      )}

      <div class="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <table class="w-full text-left">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Event</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Type</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Value</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Schedule</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {events.map((event) => {
              const now = new Date();
              const starts = new Date(event.startsAt);
              const ends = new Date(event.endsAt);
              const isLive = event.isActive && now >= starts && now <= ends;
              const isScheduled = event.isActive && now < starts;
              const isExpired = now > ends;

              return (
                <tr key={event.id} class="hover:bg-gray-50 transition">
                  <td class="px-6 py-4">
                    <div class="font-bold text-gray-900">{event.name}</div>
                    <div class="text-xs text-gray-500 truncate max-w-xs">{event.description}</div>
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-2 py-1 text-[10px] font-bold rounded bg-blue-100 text-blue-700 ring-1 ring-blue-700/10">
                      {event.type.replace('MULTIPLIER_', '')}
                    </span>
                  </td>
                  <td class="px-6 py-4 font-mono font-bold text-indigo-600">x{event.value}</td>
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
                      onClick={() => toggleActive(event.id, event.isActive)}
                      class={`text-xs font-bold ${event.isActive ? 'text-orange-600' : 'text-emerald-600'} hover:underline`}
                    >
                      {event.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button 
                      onClick={() => handleDelete(event.id)}
                      class="text-xs font-bold text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colspan={6} class="px-6 py-12 text-center text-gray-500 italic">
                  No events found. Create your first one!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
