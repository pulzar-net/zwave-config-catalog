// resolver.js: src/resolver.ts with @zwave-js/config and what it imports, as
// one script for a plain JavaScript engine (FORMAT.md). Node's built-ins are
// not there: `buffer` is its npm port, every other one a stub that throws if
// called, since the resolver reads only the filesystem it is given.

import { builtinModules, createRequire } from 'node:module'
import path from 'node:path'
import { build, type Plugin } from 'esbuild'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const require = createRequire(import.meta.url)
const PORTS: Record<string, string> = { buffer: require.resolve('buffer/') }

const environment: Plugin = {
  name: 'environment',
  setup(b) {
    const names = new Set(builtinModules.flatMap((n) => [n, `node:${n}`]))
    // Where Z-Wave JS looks for its configuration: the resolver's own filesystem.
    b.onResolve({ filter: /^#config_dir$/ }, () => ({ path: 'config_dir', namespace: 'stub' }))
    b.onLoad({ filter: /^config_dir$/, namespace: 'stub' }, () => ({ contents: 'export const configDir = "/config"', loader: 'js' }))
    b.onResolve({ filter: /.*/ }, (args) => {
      if (!names.has(args.path)) return undefined
      const name = args.path.replace(/^node:/, '')
      return PORTS[name] ? { path: PORTS[name] } : { path: name, namespace: 'stub' }
    })
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
      contents: `const fail = () => { throw new Error('node:${args.path} is not available in the resolver') };
module.exports = new Proxy(fail, { get: (_, k) => k === '__esModule' ? false : k === 'default' ? module.exports : fail });`,
      loader: 'js',
    }))
  },
}

export async function resolver() {
  const out = await build({
    entryPoints: [path.join(HERE, 'resolver.ts')], bundle: true, write: false, format: 'iife', platform: 'neutral',
    target: 'es2020', minify: true, keepNames: true, mainFields: ['module', 'main'], conditions: ['import', 'default'],
    inject: [path.join(HERE, 'globals.ts')], logLevel: 'silent', plugins: [environment],
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  return out.outputFiles![0].text
}
