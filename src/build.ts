// node src/build.ts <out>
//
// Builds the release of @zwave-js/config installed in node_modules into
// <out>/v/<version>/ (FORMAT.md): the resolver, the device index as Z-Wave
// JS builds it, which files each device file reads, a manifest and
// SHA256SUMS. The device files themselves are not published here: they are
// upstream's, read from its own package. A version once published is never
// written again.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ConfigManager } from '@zwave-js/config'
import { fs as nodeFs } from '@zwave-js/core/bindings/fs/node'
import { resolver } from './bundle.ts'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const pkg = path.dirname(require.resolve('@zwave-js/config/package.json'))
const devices = path.join(pkg, 'config', 'devices')
const VERSION: string = JSON.parse(readFileSync(path.join(pkg, 'package.json'), 'utf8')).version
const SELF: string = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
// The same module the package's own index loads, so clearing it clears theirs.
const { clearTemplateCache } = await import(pathToFileURL(path.join(pkg, 'build', 'esm', 'JsonTemplate.js')).href)

const out = path.resolve(process.argv[2] ?? 'site')
const dir = path.join(out, 'v', VERSION)
const written: Record<string, string> = {}

function put(rel: string, content: string) {
  const file = path.join(dir, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
  written[rel] = createHash('sha256').update(content).digest('hex')
}
const json = (value: unknown) => JSON.stringify(value) + '\n'
const quiet = { getLogger: () => ({ log() {} }), isLoglevelVisible: () => false, updateConfiguration() {}, destroy() {} }

const started = Date.now()
put('resolver.js', await resolver())

// The index, as Z-Wave JS builds it from the package's files.
const manager = new ConfigManager({ logContainer: quiet as never })
await manager.loadDeviceIndex()
const index = manager.getIndex() ?? []
put('index.json', json(index))

// Which files each device file reads: Z-Wave JS's own reading of it, over a
// filesystem that notes each file it opens, with its template cache empty.
const read = new Set<string>()
const noting = { ...nodeFs, readFile: async (p: string) => { read.add(p); return nodeFs.readFile(p) } }
const files: Record<string, string[]> = {}
const reader = new ConfigManager({ bindings: noting as never, logContainer: quiet as never })
await reader.loadDeviceIndex()
for (const entry of index) {
  if (files[entry.filename]) continue
  clearTemplateCache()
  read.clear()
  const found = await reader.lookupDevice(Number(entry.manufacturerId), Number(entry.productType), Number(entry.productId),
    entry.firmwareVersion.min)
  if (!found) throw new Error(`${entry.filename}: not found by its own ids`)
  files[found.filename.slice(devices.length + 1)] = [...read].filter((p) => p.startsWith(`${devices}/`))
    .map((p) => p.slice(devices.length + 1)).filter((p) => p !== 'index.json').sort()
}
for (const entry of index) if (!files[entry.filename]) throw new Error(`${entry.filename}: never read`)
put('files.json', json(files))

const licence = await fetch('https://raw.githubusercontent.com/zwave-js/zwave-js/master/LICENSE')
if (!licence.ok) throw new Error(`the Z-Wave JS licence could not be read: ${licence.status}`)
put('licenses/zwave-js.txt', await licence.text())
put('manifest.json', json({ format: 1, library: '@zwave-js/config', version: VERSION, builder: SELF,
  devices: index.length, files: Object.keys(files).length }))
writeFileSync(path.join(dir, 'SHA256SUMS'), Object.entries(written).sort().map(([f, h]) => `${h}  ${f}`).join('\n') + '\n')
console.log(`${VERSION}: ${index.length} index entries, ${Object.keys(files).length} device files, ` +
  `${((Date.now() - started) / 1000).toFixed(0)} s`)
