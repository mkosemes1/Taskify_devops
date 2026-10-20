import { useState } from 'react'

export default function StarRating({ value = 0, onRate, disabled, size = 18 }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <div className="stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${n <= shown ? 'star-on' : ''}`}
          style={{ fontSize: size }}
          disabled={disabled}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          onMouseEnter={() => !disabled && setHover(n)}
          onClick={() => onRate && onRate(n)}
        >
          ★
        </button>
      ))}
    </div>
  )
}
