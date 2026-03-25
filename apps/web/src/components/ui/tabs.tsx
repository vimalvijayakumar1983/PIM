'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  children: (activeTab: string) => React.ReactNode;
  variant?: 'underline' | 'pills';
}

export function Tabs({ tabs, defaultTab, onChange, children, variant = 'underline' }: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);

  function handleChange(id: string) {
    setActive(id);
    onChange?.(id);
  }

  return (
    <div>
      <div className={cn('flex gap-1', variant === 'underline' ? 'border-b border-gray-200' : 'bg-gray-100 p-1 rounded-xl')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-150',
              variant === 'underline'
                ? cn(
                    'border-b-2 -mb-px',
                    active === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  )
                : cn(
                    'rounded-lg',
                    active === tab.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  ),
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                'px-1.5 py-0.5 text-xs rounded-full',
                active === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600',
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-4">{children(active)}</div>
    </div>
  );
}
