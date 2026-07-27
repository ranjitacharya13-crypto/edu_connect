import * as Icons from 'lucide-react'
import StatusPill from './StatusPill'

export default function MetricCard({ label, value, hint, tone = 'blue' }) {
  const Icon = Icons[hint === 'Today' ? 'Phone' : hint === '85% reach rate' ? 'CheckCircle2' : hint === 'Urgent' ? 'AlertTriangle' : 'Sparkles']

  return (
    <article className="glass-panel floating-card rounded-3xl border p-5 shadow-glass">
      <div className="flex items-start justify-between gap-3">
        <Icon size={30} className="text-slate-700" />
        <StatusPill tone={tone}>{hint}</StatusPill>
      </div>
      <strong className="mt-4 block text-4xl font-black text-slate-950">{value}</strong>
      <p className="font-bold text-slate-700">{label}</p>
    </article>
  )
}
