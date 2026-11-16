import type { CSSProperties } from 'react'
import { Terminal } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { getAiAgentDefinition, type AiAgentId } from '../lib/aiAgents'

interface AiAgentIconProps {
  agent: AiAgentId
  className?: string
  size?: number
  title?: string
}

const ICON_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  overflow: 'hidden',
}

// Claude Code has no image here on purpose: Rhizome shows it with a neutral
// Phosphor `Terminal` glyph, never the Claude or Anthropic mark (ADR-0191 4.2).
const AI_AGENT_ICON_SOURCES: Record<Exclude<AiAgentId, 'claude_code'>, string> = {
  prime: '/ai-agent-icons/prime.png',
  codex: '/ai-agent-icons/codex.svg',
  opencode: '/ai-agent-icons/opencode.svg',
  antigravity: '/ai-agent-icons/gemini.svg',
  kiro: '/ai-agent-icons/kiro.svg',
  hermes: '/ai-agent-icons/hermes.svg',
}

export function AiAgentIcon({
  agent,
  className,
  size = 16,
  title,
}: AiAgentIconProps) {
  const label = title ?? getAiAgentDefinition(agent).label

  return (
    <span
      className={cn('rounded-[5px]', className)}
      style={{ ...ICON_STYLE, width: size, height: size }}
      role={title ? 'img' : undefined}
      aria-label={title ? label : undefined}
      aria-hidden={title ? undefined : true}
    >
      {agent === 'claude_code' ? (
        <Terminal size={size} weight="regular" aria-hidden="true" className="text-muted-foreground" />
      ) : (
        <img
          src={AI_AGENT_ICON_SOURCES[agent]}
          alt=""
          draggable={false}
          width={size}
          height={size}
          className={agent === 'codex' || agent === 'opencode' ? 'agent-mark-invert' : undefined}
          style={{ display: 'block', width: size, height: size, objectFit: 'contain' }}
        />
      )}
    </span>
  )
}
