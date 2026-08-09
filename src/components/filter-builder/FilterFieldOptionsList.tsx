import { cn } from '@/lib/utils'

interface FieldGroup {
  key: 'property' | 'content'
  label: string
  options: string[]
}

function optionTestId(field: string): string {
  return `filter-field-option-${field.replace(/[^a-z0-9_-]+/gi, '-')}`
}

export function FilterFieldOptionsList({
  listboxId,
  fieldGroups,
  options,
  highlightedIndex,
  onHighlight,
  onSelect,
}: {
  listboxId: string
  fieldGroups: FieldGroup[]
  options: string[]
  highlightedIndex: number
  onHighlight: (index: number) => void
  onSelect: (field: string) => void
}) {
  if (options.length === 0) {
    return (
      <div className="px-2 py-6 text-center text-sm text-muted-foreground" data-testid="filter-field-combobox-empty">
        No results
      </div>
    )
  }

  return (
    <>
      {fieldGroups.map((group, groupIndex) => (
        <div key={group.key}>
          {groupIndex > 0 && <div className="my-1 border-t border-border" />}
          {group.options.map((field) => {
            const optionIndex = options.indexOf(field)
            return (
              <button
                key={field}
                id={`${listboxId}-option-${optionIndex}`}
                type="button"
                role="option"
                aria-selected={optionIndex === highlightedIndex}
                className={cn(
                  'flex w-full items-center rounded px-2 py-1.5 text-left text-sm',
                  optionIndex === highlightedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => onHighlight(optionIndex)}
                onClick={() => onSelect(field)}
                data-testid={optionTestId(field)}
              >
                <span className="truncate">{field}</span>
              </button>
            )
          })}
        </div>
      ))}
    </>
  )
}
