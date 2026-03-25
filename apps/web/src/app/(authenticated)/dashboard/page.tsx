'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const STATUS_COLORS = ['#9CA3AF', '#60A5FA', '#FBBF24', '#34D399', '#10B981', '#EF4444'];

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats'),
  });

  const stats = data?.data;

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 rounded-lg" /><div className="h-64 bg-gray-200 rounded-lg" /></div>;
  }

  const kpiCards = [
    { label: 'Total Products', value: stats?.totalProducts || 0, color: 'bg-blue-500' },
    { label: 'Published Today', value: stats?.publishedToday || 0, color: 'bg-green-500' },
    { label: 'Pending Review', value: stats?.pendingReview || 0, color: 'bg-yellow-500' },
    { label: 'AI Generated (24h)', value: stats?.aiGeneratedLast24h || 0, color: 'bg-purple-500' },
    { label: 'Failed Syncs', value: stats?.failedSyncs || 0, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-6">
            <div className={`w-2 h-2 rounded-full ${card.color} mb-2`} />
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Funnel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Product Status Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats?.statusFunnel || []}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ status, count }) => `${status}: ${count}`}
              >
                {(stats?.statusFunnel || []).map((_: any, i: number) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Team Productivity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Team Productivity (This Week)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.teamProductivity || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="completedTasks" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sync Health */}
      {stats?.lastSyncTime && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Sync Health</h2>
          <p className="text-sm text-gray-600">
            Last sync: {new Date(stats.lastSyncTime).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
