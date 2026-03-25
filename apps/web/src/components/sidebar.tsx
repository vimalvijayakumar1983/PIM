'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ListTodo,
  Sparkles,
  FileCheck,
  Settings,
  Layers,
  Tags,
  Globe,
  Link2,
  Zap,
  BarChart3,
  Ruler,
  Bell,
  FileText,
  RefreshCw,
} from 'lucide-react';

const navGroups = [
  {
    label: 'Activity',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/notifications-page', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Products',
    items: [
      { href: '/products', label: 'Products', icon: Package },
      { href: '/categories', label: 'Categories', icon: FolderTree },
      { href: '/families', label: 'Families', icon: Layers },
    ],
  },
  {
    label: 'Enrichment',
    items: [
      { href: '/attributes', label: 'Attributes', icon: Tags },
      { href: '/ai', label: 'AI Generation', icon: Sparkles },
      { href: '/templates', label: 'Templates', icon: FileText },
      { href: '/rules', label: 'Rules', icon: Zap },
    ],
  },
  {
    label: 'Review',
    items: [
      { href: '/review', label: 'Review Queue', icon: FileCheck },
      { href: '/tasks', label: 'Tasks', icon: ListTodo },
      { href: '/quality', label: 'Quality', icon: BarChart3 },
    ],
  },
  {
    label: 'Connect',
    items: [
      { href: '/sync', label: 'Magento Sync', icon: RefreshCw },
      { href: '/associations', label: 'Associations', icon: Link2 },
      { href: '/locales', label: 'Locales', icon: Globe },
      { href: '/measurements', label: 'Measurements', icon: Ruler },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-[#11052C] text-white z-50 sidebar-transition flex flex-col',
        expanded ? 'w-[var(--sidebar-expanded)]' : 'w-[var(--sidebar-width)]'
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="h-[var(--topbar-height)] flex items-center justify-center border-b border-white/10 flex-shrink-0">
        <div className={cn('flex items-center gap-2 overflow-hidden', expanded ? 'px-4' : 'px-0')}>
          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          {expanded && <span className="text-lg font-semibold whitespace-nowrap">PIM</span>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {expanded && (
              <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 mx-2 rounded-md transition-all duration-150',
                    expanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  )}
                  title={!expanded ? item.label : undefined}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {expanded && (
                    <span className="text-[13px] font-medium whitespace-nowrap">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
