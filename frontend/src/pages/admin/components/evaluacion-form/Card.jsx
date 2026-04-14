export default function Card({ children, className = '' }) {
  return (
    <div className={`bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm ${className}`}>
      {children}
    </div>
  )
}
