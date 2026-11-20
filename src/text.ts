// TextEncoder and TextDecoder, which QuickJS lacks and Z-Wave JS reads as
// globalThis's when its modules load: the `buffer` package's UTF-8, which is
// all the configuration files are. Imported first by src/resolver.ts.
import { Buffer } from 'buffer'

class Encoder {
  readonly encoding = 'utf-8'
  encode(text = '') { return new Uint8Array(Buffer.from(text, 'utf8')) }
}

class Decoder {
  readonly encoding = 'utf-8'
  decode(bytes?: ArrayBufferView | ArrayBuffer) {
    if (!bytes) return ''
    const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return Buffer.from(view).toString('utf8')
  }
}

const g = globalThis as Record<string, unknown>
g.TextEncoder ??= Encoder
g.TextDecoder ??= Decoder
