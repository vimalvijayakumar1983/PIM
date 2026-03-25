'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

export default function SyncPage() {
  const queryClient = useQueryClient();

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => apiClient.get('/api/sync/status'),
  });

  const { data: approvedProducts } = useQuery({
    queryKey: ['approved-products'],
    queryFn: () => apiClient.get('/api/products', { status: 'APPROVED', pageSize: 100 }),
  });

  const syncMutation = useMutation({
    mutationFn: (productId: string) => apiClient.post(`/api/sync/push/${productId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['approved-products'] });
    },
  });

  const status = syncStatus?.data;
  const products = approvedProducts?.data?.items || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Magento Sync</h1>

      {/* Status Overview */}
      <div className="grid grid-cols-4 gap-4">
        {status?.counts?.map((c: any) => (
          <div key={c.status} className="bg-white rounded-lg shadow p-4">
            <span className={cn('px-2 py-1 rounded text-xs', getStatusColor(c.status))}>{c.status}</span>
            <p className="text-2xl font-bold mt-2">{c.count}</p>
          </div>
        ))}
      </div>

      {status?.lastSync && (
        <p className="text-sm text-gray-500">
          Last sync: {new Date(status.lastSync.time).toLocaleString()} (SKU: {status.lastSync.sku})
        </p>
      )}

      {/* Approved Products Ready to Sync */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Products Ready to Sync</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sync Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium">{p.sku}</td>
                <td className="px-4 py-3 text-sm">{p.title || '-'}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-1 rounded text-xs', getStatusColor(p.syncStatus))}>{p.syncStatus}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => syncMutation.mutate(p.id)}
                    disabled={syncMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" /> Sync
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No approved products to sync</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
