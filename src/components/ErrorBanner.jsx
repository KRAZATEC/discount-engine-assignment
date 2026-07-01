/**
 * ErrorBanner.jsx
 * Displays a list of parse or validation errors, or (with variant="warning")
 * a softer amber banner for non-fatal issues like skipped PDF rows.
 */

const VARIANTS = {
  error: {
    background: '#fce8e8', border: '1px solid #e57373', borderLeftColor: '#c0392b',
    titleColor: '#8a1a1a', textColor: '#5a1010', label: (n) => `${n} issue${n > 1 ? 's' : ''} found`,
  },
  warning: {
    background: '#fff7ec', border: '1px solid #f0c987', borderLeftColor: '#FF5800',
    titleColor: '#8a4a10', textColor: '#6b4310', label: (n) => `${n} row${n > 1 ? 's' : ''} skipped`,
  },
}

export default function ErrorBanner({ errors, variant = 'error' }) {
  if (!errors || errors.length === 0) return null
  const v = VARIANTS[variant] || VARIANTS.error
  return (
    <div
      style={{
        background: v.background,
        border: v.border,
        borderLeft: `3px solid ${v.borderLeftColor}`,
        borderRadius: 4,
        padding: '0.6rem 0.9rem',
        marginTop: '0.5rem',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, color: v.titleColor, marginBottom: 4 }}>
        {v.label(errors.length)}
      </div>
      {errors.map((e, i) => (
        <div key={i} style={{ fontSize: 12, color: v.textColor, marginTop: 2 }}>
          {e}
        </div>
      ))}
    </div>
  )
}
