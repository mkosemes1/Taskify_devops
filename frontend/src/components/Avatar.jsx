export function Avatar({ user, size = 32 }) {
  if (!user) {
    return (
      <span className="avatar avatar-empty" style={{ width: size, height: size, fontSize: size * 0.4 }}>
        ?
      </span>
    )
  }
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      className="avatar"
      title={`${user.name} · ${user.email}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: user.avatarColor || '#7c5cff',
      }}
    >
      {initials}
    </span>
  )
}
