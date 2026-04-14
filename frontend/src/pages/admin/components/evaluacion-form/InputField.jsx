export default function InputField({ label, required, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
        {hint && <span className="text-[10px] text-on-surface-variant italic">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
