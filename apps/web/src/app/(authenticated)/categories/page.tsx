'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { FolderTree, Plus } from 'lucide-react';

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', slug: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get('/api/categories/flat'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/api/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setShowAdd(false);
      setNewCat({ name: '', slug: '' });
    },
  });

  const categories = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" /> Add Category
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-4">
            <input
              placeholder="Category name"
              value={newCat.name}
              onChange={(e) => setNewCat({ name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              className="flex-1 px-3 py-2 border rounded-md text-sm"
            />
            <input
              placeholder="Slug"
              value={newCat.slug}
              onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })}
              className="flex-1 px-3 py-2 border rounded-md text-sm"
            />
            <button
              onClick={() => createMutation.mutate(newCat)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Save
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-gray-400">
                <FolderTree className="h-12 w-12 mx-auto mb-2" />
                No categories
              </td></tr>
            ) : (
              categories.map((cat: any) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{cat.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{cat.slug}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{cat._count?.products || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
