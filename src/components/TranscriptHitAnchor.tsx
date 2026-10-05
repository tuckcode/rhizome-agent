import type { CSSProperties, ReactNode } from 'react'
import { transcriptHitAnchorProps } from '../lib/sessionTranscriptHit'

export function TranscriptHitAnchor({
  index,
  focused,
  className,
  style,
  children,
}: {
  index?: number
  focused?: number | null
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const { style: hitStyle, ...attrs } = transcriptHitAnchorProps(index, focused)
  return (
    <div className={className} style={{ ...style, ...hitStyle }} {...attrs}>
      {children}
    </div>
  )
}
