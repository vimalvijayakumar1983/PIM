'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AIPage() {
  const [model, setModel] = useState<'claude' | 'gemini'>('claude');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: products } = useQuery({
    queryKey: ['products-for-ai'],
    queryFn: () => apiClient.get('/api/products', { status: 'DRAFT', pageSize: 100 }),
  });

  const bulkGenerate = useMutation({
    mutationFn: () => apiClient.post('/api/ai/generate-bulk', { productIds: selectedIds, model }),
  });

  const singleGenerate = useMutation({
    mutationFn: (productId: string) => apiClient.post(`/api/ai/generate/${productId}`, { model }),
  });

  const items = products?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Content Generation</h1>
        <div className="flex gap-2 items-center">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as any)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="claude">Claude (High Quality)</option>
            <option value="gemini">Gemini (Fast/Bulk)</option>
          </select>
          {selectedIds.length > 0 && (
            <button
              onClick={() => bulkGenerate.mutate()}
              disabled={bulkGenerate.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md text-sm"
            >
              <Zap className="h-4 w-4" />
              {bulkGenerate.isPending ? 'Generating...' : `Generate ${selectedIds.length} Products`}
            </button>
          )}
        </div>
      </div>

      {bulkGenerate.isSuccess && (
        <div className="bg-green-50 text-green-800 p-4 rounded-lg text-sm">
          {bulkGenerate.data?.data?.jobCount} AI generation jobs queued successfully!
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.length === items.length && items.length > 0}
              onChange={(e) => {
                setSelectedIds(e.target.checked ? items.map((p: any) => p.id) : []);
              }}
            />
            Select all draft products ({items.length})
          </label>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((product: any) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(product.id)}
                    onChange={(e) => {
                      setSelectedIds(e.target.checked
                        ? [...selectedIds, product.id]
                        : selectedIds.filter((id) => id !== product.id)
                      );
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium">{product.sku}</td>
                <td className="px-4 py-3 text-sm">{product.rawTitle || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{product.brand || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{product.category?.name || '-'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => singleGenerate.mutate(product.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                  >
                    <Sparkles className="h-3 w-3" /> Generate
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No draft products available for AI generation
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
