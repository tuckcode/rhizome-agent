import { cn } from '@/lib/utils'
import { resolveNoteIcon } from '../utils/noteIcon'

interface NoteTitleIconProps {
  icon: string | null | undefined
  size?: number
  className?: string
  color?: string
  testId?: string
}

function IconWrapper({
  children,
  className,
  size,
}: Pick<NoteTitleIconProps, 'className' | 'size'> & { children: React.ReactNode }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center align-middle', className)}
      style={{ width: size, height: size, lineHeight: 1 }}
    >
      {children}
    </span>
  )
}

export function NoteTitleIcon({ icon, size = 14, className, color, testId }: NoteTitleIconProps) {
  const resolved = resolveNoteIcon(icon)

  if (resolved.kind === 'none') return null

  if (resolved.kind === 'emoji') {
    return (
      <IconWrapper className={className} size={size}>
        <span style={{ fontSize: size, lineHeight: 1 }} data-testid={testId}>
          {resolved.value}
        </span>
      </IconWrapper>
    )
  }

  if (resolved.kind === 'image') {
    return (
      <IconWrapper className={className} size={size}>
        <img
          src={resolved.src}
          alt=""
          aria-hidden="true"
          className="block h-full w-full rounded-sm object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
          data-testid={testId}
        />
      </IconWrapper>
    )
  }

  return (
    <IconWrapper className={className} size={size}>
      <resolved.Icon
        width={size}
        height={size}
        className="block"
        style={color ? { color } : undefined}
        data-testid={testId}
      />
    </IconWrapper>
  )
}
