import { spawn } from 'node:child_process'

const IS_WINDOWS = process.platform === 'win32'

/**
 * Spawn `pnpm` with the given args, on every platform.
 *
 * On Windows `pnpm` is a `.cmd` shim, which `spawn` cannot run directly
 * (ENOENT, C82). Node's documented route for `.cmd` files is `cmd.exe /c`;
 * it avoids `shell: true`, which Node deprecates when args are passed.
 */
export function spawnPnpm(args, options) {
  if (IS_WINDOWS) {
    return spawn('cmd.exe', ['/d', '/c', 'pnpm', ...args], options)
  }

  return spawn('pnpm', args, options)
}
