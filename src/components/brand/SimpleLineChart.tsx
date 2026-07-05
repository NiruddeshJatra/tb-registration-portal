interface Point {
  label: string
  value: number
}

export function SimpleLineChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>
  }
  const width = 600
  const height = 160
  const padding = 24
  const max = Math.max(...data.map((d) => d.value), 1)
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0

  const points = data.map((d, i) => {
    const x = padding + i * stepX
    const y = height - padding - (d.value / max) * (height - padding * 2)
    return { x, y, ...d }
  })

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border)" strokeWidth="1" />
      <path d={path} fill="none" stroke="var(--bright-green)" strokeWidth="2" />
      {points.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r="2.5" fill="var(--bright-green)" />
      ))}
      {points.map(
        (p, i) =>
          (i === 0 || i === points.length - 1) && (
            <text key={`${p.label}-label`} x={p.x} y={height - 6} fontSize="9" fill="var(--muted-foreground)" textAnchor={i === 0 ? 'start' : 'end'}>
              {p.label}
            </text>
          ),
      )}
    </svg>
  )
}
