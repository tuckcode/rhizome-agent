import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover native fork and archive', () => {
  it('forks Prime entries only on the Prime engine', () => {
    const home = readFileSync(`${process.cwd()}/src/components/ChatHome.tsx`, 'utf8')
    const panel = readFileSync(`${process.cwd()}/src/components/AiPanel.tsx`, 'utf8')
    expect(home).toContain("forkTargetsPrimeEntry={panelEngine === 'prime'}")
    expect(panel).toContain('const forkPrime = forksPrimeEntry(isPrimeTarget, forkTargetsPrimeEntry)')
    expect(panel).toContain('persistNativeFork({')
  })

  it('pairs native tool events and scopes the live session per panel', () => {
    const transcript = readFileSync(`${process.cwd()}/src/lib/nativeChatTranscript.ts`, 'utf8')
    const agent = readFileSync(`${process.cwd()}/src/hooks/useCliAiAgent.ts`, 'utf8')
    const switcher = readFileSync(`${process.cwd()}/src/components/usePrimeSessionSwitcher.ts`, 'utf8')
    expect(transcript).toContain('CANCELLED_NATIVE_TOOL_REASON')
    expect(transcript).toContain('liveNativeBySlot')
    expect(agent).toContain('createNativeLiveSlot')
    expect(agent).toContain('releaseNativeLiveSlot')
    expect(agent).toContain('setNativeSession')
    expect(transcript).toContain('beforeText')
    expect(readFileSync(`${process.cwd()}/src/lib/aiAgentStreamCallbacks.ts`, 'utf8')).toContain('beforeText || undefined')
    expect(switcher).toContain('agent.setNativeSession')
    expect(switcher).toContain('agent.getNativeSession()')
  })

  it('lists and archives native chats on the native engine', () => {
    const panel = readFileSync(`${process.cwd()}/src/components/AiPanel.tsx`, 'utf8')
    const list = readFileSync(`${process.cwd()}/src/components/PrimeSessionList.tsx`, 'utf8')
    expect(panel).toContain("const showSessionList = isPrimeTarget || chatEngine === 'native'")
    expect(panel).toContain("engine={sessionListEngine}")
    expect(list).toContain("const answer = await call<NativeChatListItem[]>('native_chat_list')")
    expect(list).toContain("'set_native_session_archived'")
  })
})
