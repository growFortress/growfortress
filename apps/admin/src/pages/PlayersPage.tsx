import { useState } from 'preact/hooks';
import { adminApi } from '../api/adminClient.js';
import { route } from 'preact-router';
import { useQuery } from '@tanstack/react-query';

export function PlayersPage(_: { path?: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['players', page, search],
    queryFn: () => adminApi.getPlayers(page, 20, search),
    placeholderData: (previousData) => previousData, // keepPreviousData in v5
    staleTime: 5000,
  });

  const handleSearchInput = (e: any) => {
    setSearch(e.currentTarget.value);
    setPage(1); // Reset to page 1 on search
  };

  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">Players</h1>
      
      <div class="mb-4 flex gap-2">
        <input 
          type="text" 
          placeholder="Search by username or ID..."
          value={search}
          onInput={handleSearchInput}
          class="p-2 border rounded w-64 text-black" 
        />
      </div>

      {error && <div class="bg-red-100 text-red-700 p-2 mb-4 rounded">{(error as Error).message}</div>}

      {isLoading && !data ? (
        <div>Loading...</div>
      ) : (
        <div class="bg-white rounded shadow overflow-hidden">
          <table class="min-w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {data?.users.map((user) => (
                <tr key={user.id} class="hover:bg-gray-50 cursor-pointer" onClick={() => route(`/players/${user.id}`)}>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">{user.displayName}</div>
                    <div class="text-sm text-gray-500">@{user.username}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class={user.role === 'ADMIN' ? 'text-purple-600 font-bold' : ''}>{user.role}</span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {user.banned ? (
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Banned
                      </span>
                    ) : (
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button 
                        onClick={(e) => { e.stopPropagation(); route(`/players/${user.id}`); }}
                        class="text-indigo-600 hover:text-indigo-900"
                    >
                        View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.totalPages > 1 && (
            <div class="px-6 py-3 flex justify-between items-center border-t">
                <button 
                    disabled={page <= 1} 
                    onClick={() => setPage(page - 1)}
                    class="px-3 py-1 border rounded disabled:opacity-50 text-black"
                >
                    Previous
                </button>
                <span class="text-gray-600">Page {page} of {data.totalPages}</span>
                <button 
                    disabled={page >= data.totalPages} 
                    onClick={() => setPage(page + 1)}
                    class="px-3 py-1 border rounded disabled:opacity-50 text-black"
                >
                    Next
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
