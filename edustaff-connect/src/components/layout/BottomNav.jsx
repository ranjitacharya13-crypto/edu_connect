import * as Icons from 'lucide-react'
import { navItems } from '../../services/data'

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="bottom-nav fixed inset-x-2 bottom-2 z-40 mx-auto grid w-[calc(100%-1rem)] max-w-md grid-cols-4 gap-1 rounded-2xl border border-slate-200/70 bg-white/75 p-1 shadow-glass backdrop-blur-2xl lg:hidden">
      {navItems.map(({ icon, label }) => {
        const Icon = Icons[icon]
        return (
          <button
            key={label}
            onClick={() => onTabChange(label)}
            className={`grid min-h-12 w-full min-w-0 grid-rows-[auto_auto] justify-items-center rounded-xl px-1 text-xs font-black leading-none transition ${
              activeTab === label
                ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20'
                : 'text-slate-700 hover:bg-white/90'
            }`}
          >
            <Icon size={20} />
            <span className="mt-1 whitespace-nowrap text-[9px] sm:text-[10px]">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
