'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn, statusColors, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { ArrowLeft, Sparkles, Check, X, Save } from 'lucide-react';
import Link from 'next/link';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasRole = useAuthStore((s) => s.hasRole);
  const [activeTab, setActiveTab] = useState('content');
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/products/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product', id] }),
  });

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/products/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product', id] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (notes: string) => api.post(`/products/${id}/reject`, { notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product', id] }),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post(`/ai/generate/${id}`, {}),
  });

  const product = data?.data;
  if (isLoading) return <div className="animate-pulse h-96 bg-gray-200 rounded-lg" />;
  if (!product) return <div>Product not found</div>;

  const tabs = [
    { id: 'content', label: 'Content' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'images', label: 'Images' },
    { id: 'seo', label: 'SEO' },
    { id: 'history', label: 'History' },
  ];

  function handleSave(field: string) {
    if (editing[field] !== undefined) {
      updateMutation.mutate({ [field]: editing[field] });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/products" className="p-2 hover:bg-gray-200 rounded-md">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{product.title || product.rawTitle || product.sku}</h1>
            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
          </div>
          <span className={cn('px-3 py-1 rounded-full text-xs font-medium', statusColors[product.status])}>
            {product.status.replace('_', ' ')}
          </span>
        </div>

        <div className="flex gap-2">
          {product.status === 'DRAFT' && (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {generateMutation.isPending ? 'Generating...' : 'Generate AI Content'}
            </button>
          )}
          {(product.status === 'AI_GENERATED' || product.status === 'IN_REVIEW') &&
            hasRole('SUPER_ADMIN', 'ADMIN', 'REVIEWER') && (
              <>
                <button
                  onClick={() => approveMutation.mutate()}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                >
                  <Check className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => rejectMutation.mutate('Needs revision')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
              </>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* AI vs Approved side-by-side */}
            {product.aiTitle && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">AI Generated</h3>
                  <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                    <div><p className="text-xs text-gray-500">Title</p><p className="text-sm">{product.aiTitle}</p></div>
                    <div><p className="text-xs text-gray-500">Short Description</p><p className="text-sm">{product.aiShortDesc}</p></div>
                    <div><p className="text-xs text-gray-500">Meta Title</p><p className="text-sm">{product.aiMetaTitle}</p></div>
                    <div><p className="text-xs text-gray-500">Meta Description</p><p className="text-sm">{product.aiMetaDesc}</p></div>
                    {product.aiModel && <p className="text-xs text-gray-400">Generated by: {product.aiModel}</p>}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Approved Content</h3>
                  <div className="space-y-4 p-4 bg-green-50 rounded-lg">
                    <div><p className="text-xs text-gray-500">Title</p><p className="text-sm">{product.title || '-'}</p></div>
                    <div><p className="text-xs text-gray-500">Short Description</p><p className="text-sm">{product.shortDesc || '-'}</p></div>
                    <div><p className="text-xs text-gray-500">Meta Title</p><p className="text-sm">{product.metaTitle || '-'}</p></div>
                    <div><p className="text-xs text-gray-500">Meta Description</p><p className="text-sm">{product.metaDesc || '-'}</p></div>
                  </div>
                </div>
              </div>
            )}

            {/* Editable Fields */}
            <div className="space-y-4">
              {['title', 'shortDesc', 'longDesc'].map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {field.replace(/([A-Z])/g, ' $1')}
                  </label>
                  <div className="flex gap-2">
                    {field === 'longDesc' ? (
                      <textarea
                        value={editing[field] ?? (product as any)[field] ?? ''}
                        onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                        rows={6}
                        className="flex-1 px-3 py-2 border rounded-md text-sm"
                      />
                    ) : (
                      <input
                        value={editing[field] ?? (product as any)[field] ?? ''}
                        onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded-md text-sm"
                      />
                    )}
                    {editing[field] !== undefined && (
                      <button onClick={() => handleSave(field)} className="p-2 bg-primary text-white rounded-md">
                        <Save className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Specifications */}
            {(product.specs || product.aiSpecs) && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Specifications</h3>
                <table className="w-full border">
                  <tbody>
                    {((product.specs || product.aiSpecs) as any[])?.map((spec: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2 text-sm font-medium bg-gray-50 w-1/3">{spec.label}</td>
                        <td className="px-3 py-2 text-sm">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* FAQs */}
            {(product.faqs || product.aiFaqs) && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">FAQs</h3>
                <div className="space-y-3">
                  {((product.faqs || product.aiFaqs) as any[])?.map((faq: any, i: number) => (
                    <div key={i} className="border rounded-md p-3">
                      <p className="text-sm font-medium">{faq.question}</p>
                      <p className="text-sm text-gray-600 mt-1">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="space-y-4 max-w-md">
            {hasRole('SUPER_ADMIN', 'ADMIN', 'FINANCE') ? (
              <>
                {['costPrice', 'sellingPrice'].map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                      {field.replace(/([A-Z])/g, ' $1')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editing[field] ?? (product as any)[field] ?? ''}
                        onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded-md text-sm"
                      />
                      {editing[field] !== undefined && (
                        <button
                          onClick={() => {
                            updateMutation.mutate({ [field]: parseFloat(editing[field]) });
                            setEditing((prev) => { const next = { ...prev }; delete next[field]; return next; });
                          }}
                          className="p-2 bg-primary text-white rounded-md"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {product.marginPct && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Margin</p>
                    <p className={cn('text-2xl font-bold', Number(product.marginPct) < 10 ? 'text-red-600' : 'text-green-600')}>
                      {Number(product.marginPct).toFixed(1)}%
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500">You don't have permission to view pricing.</p>
            )}
          </div>
        )}

        {activeTab === 'images' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {product.images?.map((img: any) => (
                <div key={img.id} className={cn('border rounded-lg p-2', img.isPrimary && 'ring-2 ring-primary')}>
                  <div className="h-32 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-400">
                    Image
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{img.altText || 'No alt text'}</p>
                  {img.isPrimary && <span className="text-xs text-primary font-medium">Primary</span>}
                </div>
              ))}
            </div>
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-400">
              <p>Drag and drop images here or click to upload</p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files) return;
                  for (const file of Array.from(files)) {
                    await api.upload(`/images/${id}/upload`, file);
                  }
                  queryClient.invalidateQueries({ queryKey: ['product', id] });
                }}
                className="mt-2"
              />
            </div>
          </div>
        )}

        {activeTab === 'seo' && product.seoValidation && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                'text-4xl font-bold',
                product.seoValidation.score >= 80 ? 'text-green-600' :
                product.seoValidation.score >= 50 ? 'text-yellow-600' : 'text-red-600'
              )}>
                {product.seoValidation.score}
              </div>
              <div>
                <p className="font-medium">SEO Score</p>
                <p className="text-sm text-gray-500">
                  {product.seoValidation.issues.length} issue{product.seoValidation.issues.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>

            {product.seoValidation.issues.length > 0 && (
              <div className="space-y-2">
                {product.seoValidation.issues.map((issue: any, i: number) => (
                  <div
                    key={i}
                    className={cn(
                      'p-3 rounded-md text-sm',
                      issue.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700',
                    )}
                  >
                    <span className="font-medium">{issue.field}:</span> {issue.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {product.auditLogs?.map((log: any) => (
              <div key={log.id} className="flex items-center gap-4 py-2 border-b text-sm">
                <span className="text-gray-500 w-40">{formatDateTime(log.createdAt)}</span>
                <span className="font-medium">{log.user?.name}</span>
                <span className="text-gray-600">{log.action}</span>
                {log.field && <span className="text-gray-400">({log.field})</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
