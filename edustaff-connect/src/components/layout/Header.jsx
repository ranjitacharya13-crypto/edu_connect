import { GraduationCap, Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { navItems } from '../../services/data'

export default function Header({ activeTab, onTabChange, user, onProfile }) {
  const { theme, toggleTheme } = useTheme()

  // Get user initials from name/email
  function getInitials() {
    if (user?.name) {
      return user.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return 'U'
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/60 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid size-8 sm:size-10 place-items-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-700/25 flex-shrink-0 floating-icon">
            <GraduationCap size={20} />
          </div>
          <span className="text-lg sm:text-xl font-black text-slate-900 truncate">EduStaff</span>
        </div>
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map(({ label }) => (
            <button
              key={label}
              onClick={() => onTabChange(label)}
              className={`rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-black transition whitespace-nowrap ${
                activeTab === label
                  ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleTheme}
            className="theme-toggle grid size-9 sm:size-11 place-items-center rounded-2xl border border-slate-200/70 bg-white/60 shadow-glass transition hover:bg-white"
            aria-label="Toggle light and dark mode"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {/* User profile initials instead of default image */}
          <button onClick={onProfile} aria-label="Open account details" className="grid size-8 sm:size-10 place-items-center rounded-full border-2 border-white bg-blue-600 text-white font-bold text-xs sm:text-sm shadow-lg flex-shrink-0">
            {getInitials()}
          </button>
        </div>
      </div>
    </header>
  )
}
