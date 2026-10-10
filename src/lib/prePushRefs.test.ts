import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// The pre-push hook sources `.husky/push-refs.sh` for its ref check. This
// test runs that same file against made-up push input, so the rule is
// checked without a real push.
const PUSH_REFS = `${process.cwd()}/.husky/push-refs.sh`

function checkPush(currentBranch: string, localRef: string, remoteRef: string) {
  const result = spawnSync(
    'sh',
    ['-c', '. "$1"; check_push_refs; echo "skip=$IS_PROTOTYPE_BRANCH"', 'sh', PUSH_REFS],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        CURRENT_BRANCH: currentBranch,
        PUSH_INPUT: `${localRef} 1111111 ${remoteRef} 2222222`,
      },
    },
  )
  return {
    allowed: result.status === 0,
    skipsGates: result.stdout.includes('skip=true'),
  }
}

describe('pre-push ref check', () => {
  it('lets a branch push to the remote branch of the same name, with gates', () => {
    expect(checkPush('claude/x', 'refs/heads/claude/x', 'refs/heads/claude/x')).toEqual({
      allowed: true,
      skipsGates: false,
    })
  })

  it('refuses a branch pushed to main', () => {
    expect(checkPush('claude/x', 'refs/heads/claude/x', 'refs/heads/main').allowed).toBe(false)
  })

  it('refuses a branch pushed to a different name', () => {
    expect(checkPush('claude/x', 'refs/heads/claude/x', 'refs/heads/claude/y').allowed).toBe(
      false,
    )
  })

  it('still allows main to main and tags, with gates', () => {
    expect(checkPush('main', 'refs/heads/main', 'refs/heads/main')).toEqual({
      allowed: true,
      skipsGates: false,
    })
    expect(checkPush('HEAD', 'HEAD', 'refs/heads/main').allowed).toBe(true)
    expect(checkPush('main', 'refs/tags/v1', 'refs/tags/v1')).toEqual({
      allowed: true,
      skipsGates: false,
    })
  })

  it('skips gates only when the pushed ref is a prototype ref', () => {
    expect(
      checkPush('prototype/p', 'refs/heads/prototype/p', 'refs/heads/prototype/p').skipsGates,
    ).toBe(true)
    expect(checkPush('prototype/p', 'refs/heads/main', 'refs/heads/main')).toEqual({
      allowed: true,
      skipsGates: false,
    })
  })
})
