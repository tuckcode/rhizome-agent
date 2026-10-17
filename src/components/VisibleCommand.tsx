import { visibleCommandParts } from '../lib/visibleCommand'

export function VisibleCommand({ command }: { command: string }) {
  return (
    <>
      {visibleCommandParts(command).map((part, index) => {
        if (part.kind === 'text') {
          return (
            <span key={index}>
              {part.text.split(/(\s+)/u).map((chunk, chunkIndex) => {
                if (!chunk) return null
                if (/^\s+$/u.test(chunk)) return <span key={chunkIndex}>{chunk}</span>
                return (
                  <span
                    key={chunkIndex}
                    className="inline-block max-w-full [overflow-wrap:anywhere]"
                  >
                    {chunk}
                  </span>
                )
              })}
            </span>
          )
        }
        if (part.kind === 'newline') {
          return (
            <span key={index}>
              <span
                aria-label="newline"
                className="ml-0.5 text-[11px] text-muted-foreground"
                data-testid="command-newline"
              >
                ⏎
              </span>
              {'\n'}
            </span>
          )
        }
        return (
          <span
            key={index}
            className="mx-0.5 inline-block rounded-sm bg-muted px-1 py-px text-[11px] text-[var(--danger-text)]"
            data-testid="command-hidden"
          >
            {`\\u{${part.hex}}`}
          </span>
        )
      })}
    </>
  )
}
