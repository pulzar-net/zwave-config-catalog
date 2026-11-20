// One release built for the tests, as the workflow builds it, and read back
// from its files as a consumer reads them, with the device files from the
// package itself (where a consumer reads them from upstream).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
export const DEVICES = path.join(path.dirname(require.resolve('@zwave-js/config/package.json')), 'config', 'devices')
let built: string | undefined

export function release() {
  if (!built) {
    const out = mkdtempSync(path.join(os.tmpdir(), 'zwc-'))
    execFileSync(process.execPath, [new URL('../src/build.ts', import.meta.url).pathname, out], { stdio: 'pipe' })
    built = path.join(out, 'v', readdirSync(path.join(out, 'v'))[0])
  }
  const dir = built
  const read = (rel: string) => readFileSync(path.join(dir, rel), 'utf8')
  const index = JSON.parse(read('index.json')) as Record<string, any>[]
  const files = JSON.parse(read('files.json')) as Record<string, string[]>
  return {
    dir, read, index, files,
    /** What a consumer sends the resolver for these ids (FORMAT.md, "Resolving a device"). */
    input(manufacturer: number, productType: number, productId: number, firmware?: string) {
      const hex = (n: number) => `0x${n.toString(16).padStart(4, '0')}`
      const entries = index.filter((e) => e.manufacturerId === hex(manufacturer) && e.productType === hex(productType)
        && e.productId === hex(productId))
      const paths = [...new Set(entries.flatMap((e) => files[e.filename]))]
      return { zwave: { manufacturer, productType, productId, firmware, index: entries,
        files: Object.fromEntries(paths.map((p) => [p, readFileSync(path.join(DEVICES, p), 'utf8')])) } }
    },
  }
}
