'use client';

import { useAuthStore } from '@/store/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChevronDown, ChevronRight, LogOut, Globe, Hash } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/products': 'Products',
  '/categories': 'Categories',
  '/families': 'Families',
  '/attributes': 'Attributes',
  '/ai': 'AI Generation',
  '/templates': 'Prompt Templates',
  '/rules': 'Rules Engine',
  '/review': 'Review Queue',
  '/tasks': 'Tasks',
  '/quality': 'Data Quality',
  '/sync': 'Magento Sync',
  '/associations': 'Associations',
  '/locales': 'Locales',
  '/measurements': 'Measurements',
  '/settings': 'Settings',
};

export function TopBar() {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((_, i) => {
    const path = '/' + segments.slice(0, i + 1).join('/');
    return { path, label: breadcrumbMap[path] || segments[i] };
  });

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <header className="h-[var(--topbar-height)] bg-white border-b border-gray-200 flex items-center justify-between px-6 fixed top-0 left-[var(--sidebar-width)] right-0 z-40">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
            <span className={i === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-500'}>
              {crumb.label}
            </span>
          </span>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Locale selector */}
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
          <Globe className="h-3.5 w-3.5" />
          en_US
        </button>

        {/* Channel selector */}
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
          <Hash className="h-3.5 w-3.5" />
          E-commerce
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium text-gray-900 leading-none">{user?.name}</p>
              <p className="text-[10px] text-gray-500 leading-none mt-0.5">{user?.role?.replace('_', ' ')}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
