import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('leftover native fork and archive', () => {
  it('forks Prime entries only on the Prime engine', () => {
    const home = readFileSync(`${process.cwd()}/src/components/ChatHome.tsx`, 'utf8')
    const panel = readFileSync(`${process.cwd()}/src/components/AiPanel.tsx`, 'utf8')
    expect(home).toContain("forkTargetsPrimeEntry={effectiveEngine === 'prime'}")
    expect(panel).toContain('const forkPrime = forksPrimeEntry(isPrimeTarget, forkTargetsPrimeEntry)')
    expect(panel).toContain('transcriptUntilMessage(agent.messages, messageId)')
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
