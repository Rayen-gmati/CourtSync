'use client'

// Barre d'onglets fixe en bas d'écran, façon iOS : fond translucide avec
// backdrop-blur, séparateur fin en haut, zone de sécurité bas (iPhone).
// Visible uniquement sur mobile (masquée à partir de md).

import type { LucideIcon } from 'lucide-react'

export type TabBarItem = {
  id: string
  label: string
  icon: LucideIcon
}

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly TabBarItem[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-main)]/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-flow-col auto-cols-fr">
        {tabs.map((tabItem) => {
          const Icon = tabItem.icon
          const isActive = tabItem.id === active
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => onChange(tabItem.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 transition-colors active:opacity-80 ${
                isActive ? 'text-[var(--accent-cta)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
              <span className="text-[10px] font-semibold">{tabItem.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
