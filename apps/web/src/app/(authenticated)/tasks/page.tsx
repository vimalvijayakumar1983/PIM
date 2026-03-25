'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/utils';
import Link from 'next/link';

const COLUMNS = ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'];

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiClient.get('/api/tasks', { pageSize: 200 }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/api/tasks/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const tasks = data?.data?.items || [];

  if (isLoading) return <div className="animate-pulse h-96 bg-gray-200 rounded-lg" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView('kanban')}
            className={cn('px-3 py-1 rounded text-sm', view === 'kanban' ? 'bg-primary text-white' : 'bg-gray-100')}
          >
            Kanban
          </button>
          <button
            onClick={() => setView('list')}
            className={cn('px-3 py-1 rounded text-sm', view === 'list' ? 'bg-primary text-white' : 'bg-gray-100')}
          >
            List
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t: any) => t.status === col);
            return (
              <div key={col} className="bg-gray-100 rounded-lg p-4 min-h-[400px]">
                <h3 className="font-medium text-sm text-gray-700 mb-3">
                  {col.replace('_', ' ')} ({colTasks.length})
                </h3>
                <div className="space-y-2">
                  {colTasks.map((task: any) => (
                    <div key={task.id} className="bg-white rounded-md p-3 shadow-sm">
                      <Link href={`/products/${task.productId}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {task.product?.sku || task.productId}
                      </Link>
                      <p className="text-xs text-gray-500 mt-1">{task.type.replace('_', ' ')}</p>
                      {task.assignedTo && (
                        <p className="text-xs text-gray-400 mt-1">{task.assignedTo.name}</p>
                      )}
                      {task.notes && <p className="text-xs text-gray-400 mt-1 truncate">{task.notes}</p>}
                      <div className="flex gap-1 mt-2">
                        {COLUMNS.filter((c) => c !== col).map((c) => (
                          <button
                            key={c}
                            onClick={() => updateMutation.mutate({ id: task.id, status: c })}
                            className="text-xs px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            {c.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map((task: any) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/products/${task.productId}`} className="text-blue-600 hover:underline">
                      {task.product?.sku}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{task.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-sm">{task.assignedTo?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-1 rounded-full text-xs', getStatusColor(task.status))}>{task.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
