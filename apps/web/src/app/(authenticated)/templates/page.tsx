'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Plus, FileText } from 'lucide-react';

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiClient.get('/api/prompt-templates'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/api/prompt-templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setEditing(null);
    },
  });

  const templates = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Prompt Templates</h1>
        <button
          onClick={() => setEditing({
            name: '',
            titlePrompt: 'Generate a product title for {{product}}',
            descPrompt: 'Write a product description for {{product}}',
            specsPrompt: 'Extract specifications from {{product}}',
            faqPrompt: 'Generate FAQs for {{product}}',
            seoPrompt: 'Generate SEO metadata for {{product}}',
            preferredModel: 'claude',
          })}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {editing && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="font-semibold">{editing.id ? 'Edit Template' : 'New Template'}</h2>
          <input
            placeholder="Template name"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
          {['titlePrompt', 'descPrompt', 'specsPrompt', 'faqPrompt', 'seoPrompt'].map((field) => (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{field}</label>
              <textarea
                value={editing[field]}
                onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
          ))}
          <select
            value={editing.preferredModel}
            onChange={(e) => setEditing({ ...editing, preferredModel: e.target.value })}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate(editing)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Save
            </button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {isLoading ? (
          <div className="animate-pulse h-32 bg-gray-200 rounded-lg" />
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-2" />
            No templates yet
          </div>
        ) : (
          templates.map((t: any) => (
            <div key={t.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{t.name}</h3>
                  <p className="text-sm text-gray-500">Version {t.version} | Model: {t.preferredModel}</p>
                  {t.categories?.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Categories: {t.categories.map((c: any) => c.name).join(', ')}
                    </p>
                  )}
                </div>
                <span className={`px-2 py-1 rounded text-xs ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {t.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
