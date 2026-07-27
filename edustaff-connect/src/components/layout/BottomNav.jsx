import * as Icons from 'lucide-react'
import { navItems } from '../../services/data'

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="fixed inset-x-2 bottom-2 z-40 grid grid-cols-5 rounded-3xl border border-slate-200/70 bg-white/75 p-1.5 sm:p-2 shadow-glass backdrop-blur-2xl md:hidden gap-1">
      {navItems.map(({ icon, label }) => {
        const Icon = Icons[icon]
        return (
          <button
            key={label}
            onClick={() => onTabChange(label)}
            className={`grid min-h-12 sm:min-h-14 place-items-center rounded-2xl text-xs font-black transition ${
              activeTab === label
                ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20'
                : 'text-slate-700 hover:bg-white/90'
            }`}
          >
            <Icon size={20} />
            <span className="mt-1 text-[10px]">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
