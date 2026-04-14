export default function HelpBox({ title, items, tone = 'primary' }) {
  const toneCls = tone === 'secondary'
    ? 'bg-secondary-container/20 border-secondary/20 text-secondary'
    : 'bg-primary/5 border-primary/10 text-primary'

  return (
    <div className={`p-4 rounded-xl border ${toneCls}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-sm">info</span>
        <p className="text-xs font-bold uppercase tracking-widest">{title}</p>
      </div>
      <ul className="space-y-1.5 text-xs text-on-surface-variant">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-bold text-primary">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
