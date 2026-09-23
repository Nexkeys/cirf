// The faint power-line drawing in the corner of the green promise cards.
export function Pylons({ className }) {
  return (
    <svg viewBox="0 0 150 110" className={className} aria-hidden="true">
      <path d="M118 108 128 10l10 98M121 78h14M123 56h10M125 34h6M112 22h32M114 40h28" />
      <path d="M121 78l12-22M135 78l-12-22M123 56l8-22M133 56l-8-22" />
      <path d="M62 108 69 44l7 64M58 56h22M60 70h18M64 88h10" />
      <path d="M0 108h150M144 22C110 34 92 44 80 56M112 22C96 30 84 40 76 56" />
      <path d="M8 108v-14l12-8 12 8v14M14 108v-8h8v8" />
    </svg>
  )
}
