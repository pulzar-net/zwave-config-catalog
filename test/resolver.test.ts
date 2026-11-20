// The resolver, Z-Wave JS's own lookup run in QuickJS over the files a
// consumer sends it, against the same lookup in Node over the whole package:
// golden devices whose settings differ by firmware, then every device of the
// release at both ends of its firmware range.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ConfigManager } from '@zwave-js/config'
import { release } from './release.ts'
import { load } from './sandbox.ts'

const quiet = { getLogger: () => ({ log() {} }), isLoglevelVisible: () => false, updateConfiguration() {}, destroy() {} }
const node = new ConfigManager({ logContainer: quiet as never })
await node.loadDeviceIndex()

/** Upstream's answer in Node, in the resolver's shape. */
async function upstream(m: number, t: number, p: number, fw?: string) {
  const d = await node.lookupDevice(m, t, p, fw)
  if (!d) return null
  return JSON.parse(JSON.stringify({ file: d.filename.split('/config/devices/').pop(), label: d.label,
    manufacturer: d.manufacturer, paramInformation: [...(d.paramInformation?.values() ?? [])] }))
}
const shape = (d: Record<string, any> | null) => d && { file: d.file, label: d.label, manufacturer: d.manufacturer,
  paramInformation: d.paramInformation }

const r = release()
const resolver = await load(r.read('resolver.js'))

type Golden = { name: string; ids: [number, number, number]; firmwares: [string, string]; parameter: number; label: string }
const GOLDEN: Golden[] = [
  { name: 'Zooz ZSE40 4-in-1 sensor', ids: [0x027a, 0x2021, 0x2101], firmwares: ['1.10', '16.9'], parameter: 1,
    label: 'Temperature Scale' },
  { name: 'Aeotec MultiSensor 6 ZW100 (US)', ids: [0x0086, 0x0102, 0x0064], firmwares: ['1.7', '1.13'], parameter: 2,
    label: 'Wake Device for 10 minutes After Power On' },
]

for (const g of GOLDEN) {
  test(g.name, async () => {
    const counts: number[] = []
    for (const fw of g.firmwares) {
      const out = resolver.call('decodeUplink', r.input(...g.ids, fw))
      assert.deepEqual(shape(out.data), await upstream(...g.ids, fw), `at ${fw}`)
      const p = out.data.paramInformation.find((x: { parameterNumber: number }) => x.parameterNumber === g.parameter)
      assert.equal(p.label, g.label)
      assert.deepEqual(p.options.map((o: { value: number }) => o.value), [0, 1])
      assert.ok(r.files[out.data.file].includes(out.data.file))
      counts.push(out.data.paramInformation.length)
    }
    assert.notEqual(counts[0], counts[1], 'its settings differ by firmware')
  })
}

test('a device the release has no file for', () => {
  assert.equal(resolver.call('decodeUplink', r.input(0xfffe, 1, 1, '1.0')).data, null)
})

test('every device, at both ends of its firmware range, as Z-Wave JS resolves it', { timeout: 1_800_000 }, async () => {
  const differ: string[] = []
  let calls = 0
  const started = performance.now()
  for (const e of r.index) {
    const ids = [Number(e.manufacturerId), Number(e.productType), Number(e.productId)] as const
    for (const fw of new Set([e.firmwareVersion.min, ...(e.firmwareVersion.max === '255.255' ? [] : [e.firmwareVersion.max])])) {
      calls++
      const here = shape(resolver.call('decodeUplink', r.input(...ids, fw)).data)
      const there = await upstream(...ids, fw)
      if (JSON.stringify(here) !== JSON.stringify(there)) differ.push(`${e.filename} at ${fw}`)
    }
  }
  console.log(`resolver: ${calls} lookups, ${((performance.now() - started) / calls).toFixed(1)} ms each, ` +
    `load ${resolver.loadMs.toFixed(0)} ms, heap ${(resolver.heap() / 1048576).toFixed(1)} MB, ` +
    `${(Buffer.byteLength(r.read('resolver.js')) / 1024).toFixed(0)} KB of source`)
  assert.deepEqual(differ.slice(0, 20), [])
})
