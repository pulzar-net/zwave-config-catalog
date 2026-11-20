// The resolver: @zwave-js/config's own ConfigManager, unchanged, run in a
// plain JavaScript engine (QuickJS) over an in-memory filesystem holding the
// device files a lookup needs. FORMAT.md has the interface.
//
//   decodeUplink({zwave: {manufacturer, productType, productId, firmware?, sdkVersion?, index, files}})
//     -> {data: device | null, warnings: []}
//
// `index` is the release's index.json (or the entries of it for these ids),
// `files` the device files those entries name and every file they import, as
// upstream publishes them (path under config/devices -> text). The lookup,
// the `$import` templates and the `$if` conditions are Z-Wave JS's own.

import './text.ts'
import { ConfigManager } from '@zwave-js/config'

type Any = any // Z-Wave JS's own types pass through
const ROOT = '/config'
const DEVICES = `${ROOT}/devices`
const encoder = new TextEncoder()

class NotFound extends Error {
  code = 'ENOENT'
}

/** The filesystem Z-Wave JS reads its configuration from: these files, nothing to write. */
function memoryFs(files: Record<string, string>, indexText: string) {
  const all = new Map<string, Uint8Array>(Object.entries(files).map(([p, text]) => [`${DEVICES}/${p}`, encoder.encode(text)]))
  all.set(`${DEVICES}/index.json`, encoder.encode(indexText))
  const dirs = new Set<string>([ROOT])
  for (const p of all.keys()) for (let d = p.slice(0, p.lastIndexOf('/')); d.length > ROOT.length; d = d.slice(0, d.lastIndexOf('/'))) dirs.add(d)
  // The index is newer than every file, so Z-Wave JS takes it as it is
  // rather than building it again from the files.
  const OLD = new Date(0)
  const NEW = new Date(1)
  const stat = (p: string) => {
    if (all.has(p)) return { isFile: () => true, isDirectory: () => false, mtime: p.endsWith('/index.json') ? NEW : OLD, size: all.get(p)!.length }
    if (dirs.has(p)) return { isFile: () => false, isDirectory: () => true, mtime: OLD, size: 0 }
    throw new NotFound(`ENOENT: ${p}`)
  }
  return {
    async readFile(p: string) {
      const found = all.get(p)
      if (!found) throw new NotFound(`ENOENT: ${p}`)
      return found
    },
    async stat(p: string) { return stat(p) },
    async readDir(p: string) {
      if (!dirs.has(p)) throw new NotFound(`ENOENT: ${p}`)
      const prefix = `${p}/`
      const names = new Set<string>()
      for (const q of [...all.keys(), ...dirs]) if (q.startsWith(prefix)) names.add(q.slice(prefix.length).split('/')[0])
      return [...names].sort()
    },
    async writeFile() {},
    async ensureDir() {},
    async deleteDir() {},
    async copyFile() {},
    async open() { throw new Error('not available') },
    async makeTempDir() { throw new Error('not available') },
  }
}

// Z-Wave JS logs through a container it is given; nobody reads these logs.
const silent = { getLogger: () => ({ log() {} }), isLoglevelVisible: () => false, updateConfiguration() {}, destroy() {} }

// Z-Wave JS's maps (Map, its ObjectKeyMap) as lists of their values.
const listed = (m: Any) => (m ? [...m.values()] : [])
const plain = (value: unknown) => JSON.parse(JSON.stringify(value))

async function resolve(input: Any) {
  const z = input.zwave
  const indexText = typeof z.index === 'string' ? z.index : JSON.stringify(z.index)
  const manager = new ConfigManager({ bindings: memoryFs(z.files ?? {}, indexText) as Any, logContainer: silent as Any })
  await manager.loadDeviceIndex()
  const device = await manager.lookupDevice(z.manufacturer, z.productType, z.productId, z.firmware, z.sdkVersion)
  if (!device) return { data: null, warnings: [] }
  return {
    data: {
      file: device.filename.slice(DEVICES.length + 1),
      manufacturer: device.manufacturer, label: device.label, description: device.description,
      firmwareVersion: device.firmwareVersion, preferred: device.preferred,
      // Upstream's evaluation for this device and firmware: each parameter's
      // variant whose condition holds, its options filtered, its range made.
      paramInformation: plain(listed(device.paramInformation)),
      associations: plain(listed(device.associations)),
      metadata: plain(device.metadata ?? {}),
    },
    warnings: [],
  }
}

;(globalThis as Any).decodeUplink = resolve
