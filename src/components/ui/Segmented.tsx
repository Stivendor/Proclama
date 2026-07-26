import type { ReactNode } from 'react'

// Selector segmentado: dos+ opciones mutuamente excluyentes en un solo control
export default function Segmented<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
}) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 3 }}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
              borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              background: active ? 'var(--bg-hover)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'background .15s, color .15s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
