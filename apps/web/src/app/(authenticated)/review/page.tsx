'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { Check, X, Eye } from 'lucide-react';

export default function ReviewPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => apiClient.get('/api/products', { status: 'AI_GENERATED', pageSize: 100 }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/products/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['review-queue'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/products/${id}/reject`, { notes: 'Rejected from review queue' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['review-queue'] }),
  });

  const products = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Review Queue</h1>
      <p className="text-gray-500">Products with AI-generated content awaiting review</p>

      {isLoading ? (
        <div className="animate-pulse h-64 bg-gray-200 rounded-lg" />
      ) : products.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <Check className="h-12 w-12 mx-auto mb-2" />
          <p>No products pending review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product: any) => (
            <div key={product.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-gray-500">{product.sku}</span>
                    {product.brand && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{product.brand}</span>}
                  </div>
                  <h3 className="font-medium">{product.aiTitle || product.rawTitle || 'Untitled'}</h3>
                  {product.aiShortDesc && (
                    <p className="text-sm text-gray-600 mt-1">{product.aiShortDesc}</p>
                  )}
                  {product.aiMetaTitle && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <span className="text-gray-500">Meta:</span> {product.aiMetaTitle}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <Link
                    href={`/products/${product.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50"
                  >
                    <Eye className="h-3 w-3" /> View
                  </Link>
                  <button
                    onClick={() => approveMutation.mutate(product.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(product.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
