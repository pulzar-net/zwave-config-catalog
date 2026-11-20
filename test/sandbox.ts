// Running a codec as FORMAT.md describes, in QuickJS (quickjs-emscripten):
// call the function, drain the engine's job queue, read what settled or, for
// the resolver, its answer.
import { getQuickJS, shouldInterruptAfterDeadline } from 'quickjs-emscripten'

export type Loaded = { call: (fn: string, input: unknown) => any; heap: () => number; loadMs: number; dispose: () => void }

export async function load(code: string): Promise<Loaded> {
  const QuickJS = await getQuickJS()
  const runtime = QuickJS.newRuntime()
  runtime.setMemoryLimit(64 * 1024 * 1024)
  runtime.setMaxStackSize(1024 * 1024)
  const context = runtime.newContext()
  const t = performance.now()
  const loaded = context.evalCode(code, 'codec.js')
  const loadMs = performance.now() - t
  if (loaded.error) throw new Error(`load: ${JSON.stringify(context.dump(loaded.error)).slice(0, 400)}`)
  loaded.value.dispose()
  const read = (name: string) => {
    const h = context.getProp(context.global, name)
    const v = context.typeof(h) === 'string' ? context.getString(h) : undefined
    h.dispose()
    return v
  }
  return {
    loadMs,
    call(fn, input) {
      runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 5000))
      const res = context.evalCode(`globalThis.__out = undefined; Promise.resolve(${fn}(${JSON.stringify(input)})).then(
        (o) => { globalThis.__out = JSON.stringify(o) }, (e) => { globalThis.__out = JSON.stringify({ error: String(e && e.stack || e) }) })`)
      if (res.error) throw new Error(JSON.stringify(context.dump(res.error)).slice(0, 400))
      res.value.dispose()
      const jobs = runtime.executePendingJobs()
      if (jobs.error) throw new Error(JSON.stringify(context.dump(jobs.error)).slice(0, 400))
      let out = read('__out')
      if (out === undefined) {
        const p = context.evalCode('JSON.stringify(globalThis.__codec_pending())')
        if (p.error) throw new Error(JSON.stringify(context.dump(p.error)).slice(0, 400))
        out = context.getString(p.value)
        p.value.dispose()
      }
      const parsed = JSON.parse(out)
      if (parsed.error) throw new Error(parsed.error.slice(0, 400))
      return parsed
    },
    heap() {
      const h = runtime.computeMemoryUsage()
      const used = context.dump(h).memory_used_size
      h.dispose()
      return used
    },
    dispose() { context.dispose(); runtime.dispose() },
  }
}
