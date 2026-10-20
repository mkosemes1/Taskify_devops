export default function ProgressBar({ value = 0, height = 8 }) {
  const v = Math.max(0, Math.min(100, value))
  const color = v === 100 ? '#2f9e6e' : v > 0 ? '#7c5cff' : '#dee2e6'
  return (
    <div className="progress" style={{ height }}>
      <div className="progress-fill" style={{ width: `${v}%`, background: color }} />
    </div>
  )
}
