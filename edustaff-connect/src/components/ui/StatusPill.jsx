const toneClasses = {
  blue: 'border-blue-600 bg-blue-600/10 text-blue-800',
  red: 'border-red-600 bg-red-600/10 text-red-800',
  green: 'border-emerald-600 bg-emerald-600/10 text-emerald-800',
  amber: 'border-amber-600 bg-amber-600/10 text-amber-800',
  violet: 'border-violet-600 bg-violet-600/10 text-violet-800',
}

export default function StatusPill({ children, tone = 'blue' }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${toneClasses[tone]}`}>
      {children}
    </span>
  )
}
