'use client'

// Segmented control façon iOS : conteneur pill enfoncé (fond inset) et
// pastille active qui glisse avec une transition douce.

type Option<T extends string> = { value: T; label: string }

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  const index = Math.max(0, options.findIndex((option) => option.value === value))
  const count = options.length

  return (
    <div className={`relative inline-grid grid-flow-col auto-cols-fr rounded-full bg-[var(--bg-inset)] p-1 ${className}`}>
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-full bg-[var(--accent-cta)] shadow-sm transition-transform duration-300 ease-out"
        style={{
          width: `calc(${100 / count}% - 4px)`,
          transform: `translateX(calc(${index * 100}% + ${index * 4}px))`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`relative z-10 px-4 min-h-[36px] rounded-full text-sm font-semibold transition-colors duration-200 active:opacity-90 ${
              active ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
