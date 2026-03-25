'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Search, Upload, Sparkles, ChevronLeft, ChevronRight, ChevronDown,
  Columns3, MoreHorizontal, Trash2, CheckSquare, Square, Image as ImageIcon,
  FolderTree, Filter, X, ArrowUpDown, Package
} from 'lucide-react';

const ALL_COLUMNS = [
  { key: 'image', label: 'Image', default: true, width: 'w-16' },
  { key: 'sku', label: 'SKU', default: true, width: 'w-32' },
  { key: 'title', label: 'Label', default: true, width: 'flex-1' },
  { key: 'family', label: 'Family', default: true, width: 'w-32' },
  { key: 'status', label: 'Status', default: true, width: 'w-28' },
  { key: 'completeness', label: 'Completeness', default: true, width: 'w-28' },
  { key: 'category', label: 'Category', default: false, width: 'w-32' },
  { key: 'brand', label: 'Brand', default: false, width: 'w-28' },
  { key: 'priority', label: 'Priority', default: false, width: 'w-24' },
  { key: 'createdAt', label: 'Created', default: false, width: 'w-28' },
  { key: 'updatedAt', label: 'Updated', default: true, width: 'w-28' },
];

const STATUS_OPTIONS = ['DRAFT', 'AI_GENERATED', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'];
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-400', AI_GENERATED: 'bg-blue-500', IN_REVIEW: 'bg-amber-500',
  APPROVED: 'bg-green-500', PUBLISHED: 'bg-emerald-600', ARCHIVED: 'bg-gray-300',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', AI_GENERATED: 'AI Generated', IN_REVIEW: 'In Review',
  APPROVED: 'Approved', PUBLISHED: 'Published', ARCHIVED: 'Archived',
};

function CompletenessCircle({ value }: { value: number }) {
  const size = 24;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#059669' : value >= 50 ? '#d97706' : '#dc2626';

  return (
    <div className="flex items-center gap-1.5">
      <svg width={size} height={size} className="completeness-ring">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="text-xs text-gray-600">{value}%</span>
    </div>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  );
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-flat'],
    queryFn: () => api.get('/categories/flat'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, filters, page, pageSize, categoryFilter, sortBy, sortOrder],
    queryFn: () => {
      const params: Record<string, any> = { page, pageSize, sortBy, sortOrder };
      if (search) params.search = search;
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.brand) params.brand = filters.brand;
      if (categoryFilter) params.categoryId = categoryFilter;
      return api.get('/products', params);
    },
  });

  const products = data?.data?.items || [];
  const total = data?.data?.total || 0;
  const totalPages = data?.data?.totalPages || 1;
  const categories = categoriesData?.data || [];

  const columns = useMemo(() => ALL_COLUMNS.filter(c => visibleColumns.has(c.key)), [visibleColumns]);

  const allSelected = products.length > 0 && products.every((p: any) => selectedIds.has(p.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p: any) => p.id)));
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function addFilter(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function removeFilter(key: string) {
    setFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPage(1);
  }

  function handleSort(key: string) {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  }

  const activeFilters = Object.entries(filters).filter(([, v]) => v);

  return (
    <div className="flex h-[calc(100vh-var(--topbar-height))]">
      {/* Category Tree Sidebar */}
      <div className="w-56 border-r border-gray-200 bg-white flex-shrink-0 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categories</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => { setCategoryFilter(''); setPage(1); }}
            className={cn(
              'w-full text-left px-3 py-1.5 rounded text-sm transition-colors',
              !categoryFilter ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            All products
            <span className="float-right text-xs text-gray-400">{total}</span>
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => { setCategoryFilter(cat.id); setPage(1); }}
              className={cn(
                'w-full text-left px-3 py-1.5 rounded text-sm transition-colors mt-0.5',
                categoryFilter === cat.id ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              {cat.name}
              <span className="float-right text-xs text-gray-400">{cat._count?.products || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <div className="h-5 w-px bg-gray-200" />

          {/* Filter button */}
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors',
              activeFilters.length > 0 ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {activeFilters.length > 0 && (
              <span className="ml-1 bg-purple-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilters.length}
              </span>
            )}
          </button>

          {/* Column config */}
          <div className="relative">
            <button
              onClick={() => setShowColumnConfig(!showColumnConfig)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </button>
            {showColumnConfig && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => {
                        const next = new Set(visibleColumns);
                        if (next.has(col.key)) next.delete(col.key);
                        else next.add(col.key);
                        setVisibleColumns(next);
                      }}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-gray-200" />

          {/* Actions */}
          <Link href="/products/import" className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50">
            <Upload className="h-3.5 w-3.5" />
            Import
          </Link>
          <Link href="/ai" className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700">
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </Link>
        </div>

        {/* Filter chips + mass actions */}
        {(activeFilters.length > 0 || selectedIds.size > 0) && (
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <span className="text-sm font-medium text-purple-700">{selectedIds.size} selected</span>
                <button className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
                  <Sparkles className="h-3 w-3" /> AI Generate
                </button>
                <button className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
                <div className="h-4 w-px bg-gray-300" />
              </>
            )}
            {activeFilters.map(([key, value]) => (
              <span key={key} className="flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-300 rounded-full text-xs text-gray-700">
                {key}: {value}
                <button onClick={() => removeFilter(key)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {activeFilters.length > 0 && (
              <button onClick={() => { setFilters({}); setPage(1); }} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear all</button>
            )}
          </div>
        )}

        {/* Filter panel */}
        {showFilterPanel && (
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
            <select
              value={filters.status || ''}
              onChange={(e) => e.target.value ? addFilter('status', e.target.value) : removeFilter('status')}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select
              value={filters.priority || ''}
              onChange={(e) => e.target.value ? addFilter('priority', e.target.value) : removeFilter('priority')}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <input
              placeholder="Filter by brand..."
              value={filters.brand || ''}
              onChange={(e) => e.target.value ? addFilter('brand', e.target.value) : removeFilter('brand')}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm w-48"
            />
          </div>
        )}

        {/* Data Grid */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="w-10 px-3 py-2.5 border-b border-gray-200">
                  <button onClick={toggleSelectAll}>
                    {allSelected ? <CheckSquare className="h-4 w-4 text-purple-600" /> : <Square className="h-4 w-4 text-gray-400" />}
                  </button>
                </th>
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={cn('px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100', col.width)}
                    onClick={() => ['sku', 'title', 'status', 'updatedAt', 'createdAt'].includes(col.key) ? handleSort(col.key) : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortBy === col.key && <ArrowUpDown className="h-3 w-3" />}
                    </div>
                  </th>
                ))}
                <th className="w-10 px-3 py-2.5 border-b border-gray-200" />
              </tr>
            </thead>
            <tbody className="bg-white">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td colSpan={columns.length + 2} className="px-3 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="py-20 text-center">
                    <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm">No products found</p>
                    <p className="text-gray-400 text-xs mt-1">Try adjusting your filters or import products</p>
                  </td>
                </tr>
              ) : (
                products.map((product: any) => (
                  <tr
                    key={product.id}
                    className={cn(
                      'border-b border-gray-100 hover:bg-purple-50/30 transition-colors cursor-pointer',
                      selectedIds.has(product.id) && 'bg-purple-50/50'
                    )}
                  >
                    <td className="px-3 py-2">
                      <button onClick={(e) => { e.stopPropagation(); toggleSelect(product.id); }}>
                        {selectedIds.has(product.id)
                          ? <CheckSquare className="h-4 w-4 text-purple-600" />
                          : <Square className="h-4 w-4 text-gray-300 hover:text-gray-500" />
                        }
                      </button>
                    </td>
                    {columns.map(col => (
                      <td key={col.key} className="px-3 py-2">
                        {col.key === 'image' && (
                          <div className="w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                            {product.images?.[0] ? (
                              <ImageIcon className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-gray-300" />
                            )}
                          </div>
                        )}
                        {col.key === 'sku' && (
                          <Link href={`/products/${product.id}`} className="text-sm font-mono text-purple-600 hover:text-purple-800 hover:underline">
                            {product.sku}
                          </Link>
                        )}
                        {col.key === 'title' && (
                          <Link href={`/products/${product.id}`} className="text-sm text-gray-900 hover:text-purple-700">
                            {product.title || product.rawTitle || <span className="text-gray-400 italic">No label</span>}
                          </Link>
                        )}
                        {col.key === 'family' && (
                          <span className="text-xs text-gray-500">{product.family?.name || '-'}</span>
                        )}
                        {col.key === 'category' && (
                          <span className="text-xs text-gray-500">{product.category?.name || '-'}</span>
                        )}
                        {col.key === 'brand' && (
                          <span className="text-xs text-gray-500">{product.brand || '-'}</span>
                        )}
                        {col.key === 'status' && (
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[product.status])} />
                            <span className="text-xs text-gray-700">{STATUS_LABELS[product.status] || product.status}</span>
                          </div>
                        )}
                        {col.key === 'completeness' && (
                          <CompletenessCircle value={Math.round(product.completeness || 0)} />
                        )}
                        {col.key === 'priority' && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded',
                            product.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                            product.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                            product.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          )}>
                            {product.priority}
                          </span>
                        )}
                        {col.key === 'createdAt' && (
                          <span className="text-xs text-gray-500">{new Date(product.createdAt).toLocaleDateString()}</span>
                        )}
                        {col.key === 'updatedAt' && (
                          <span className="text-xs text-gray-500">{new Date(product.updatedAt).toLocaleDateString()}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <Link href={`/products/${product.id}`}>
                        <MoreHorizontal className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500">
            {total > 0 ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total} results` : 'No results'}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-gray-600 px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
