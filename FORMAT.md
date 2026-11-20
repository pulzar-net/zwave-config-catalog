# Format, version 1

What a release of zwave-config-catalog contains, and how to use it without
Node or Z-Wave JS: find which of Z-Wave JS's device configuration files a
device is, and that file read for its firmware (its parameters, their
options and ranges, its associations), with a script any JavaScript engine
can run (QuickJS included).

A release is built from one release of
[`@zwave-js/config`](https://www.npmjs.com/package/@zwave-js/config)
(Z-Wave JS's device configuration, MIT) and named after it. The device files
themselves are not here: they are upstream's, read from that package.

## Where

| | |
|---|---|
| `https://pulzar-net.github.io/zwave-config-catalog/versions.json` | `{latest, versions}`: the releases served below, newest first |
| `https://pulzar-net.github.io/zwave-config-catalog/v/<version>/<file>` | a release's files, for the newest ten |
| GitHub release `zwave-config-<version>` | every release, permanently: `zwave-config-catalog-<version>.tar.gz` (the files below) and `SHA256SUMS` |
| `https://registry.npmjs.org/@zwave-js%2fconfig/<version>` | the package itself, whose `config/devices/` are the device files (check the tarball against the registry's `dist.integrity`) |

Files are never changed once published. `manifest.json` names the builder
that made them.

## Files

| File | What |
|---|---|
| `manifest.json` | `{format: 1, library, version, builder, devices, files}` |
| `SHA256SUMS` | the SHA-256 of every other file, `sha256sum` format |
| `index.json` | the device index exactly as Z-Wave JS builds it from the package: `[{manufacturerId, manufacturer, label, productType, productId, firmwareVersion: {min, max}, preferred?, filename}]`, ids as `0x` and four hex digits |
| `files.json` | `{filename: [path, ...]}`: for every device file, the files Z-Wave JS reads to load it (itself and every template it imports), paths under `config/devices/` |
| `resolver.js` | Z-Wave JS's own configuration lookup, as one script (about 200 KB) |
| `licenses/zwave-js.txt` | the licence of Z-Wave JS, which the resolver carries |

## Resolving a device

Evaluate `resolver.js`, then call

```
decodeUplink({zwave: {manufacturer, productType, productId, firmware?, sdkVersion?, index, files}})
  -> {data: device | null, warnings: []}
```

- `manufacturer`, `productType`, `productId`: the device's ids, numbers;
  `firmware`: its firmware version as Z-Wave JS writes it (`"1.10"`), when
  known.
- `index`: the entries of `index.json` with these ids (all of it works too).
- `files`: for each of those entries' `filename`, every path `files.json`
  lists for it, with the file's text from the package.
- `data`: `null` for a device the release has no file for; otherwise
  `{file, manufacturer, label, description, firmwareVersion, preferred,
  paramInformation, associations, metadata}`: Z-Wave JS's own lookup (the
  preferred entry, the firmware range), `$import` templates and `$if`
  conditions for this device and firmware. Each of `paramInformation` is
  `{parameterNumber, valueBitMask?, label, description?, valueSize, minValue,
  maxValue, allowed, unsigned, defaultValue, unit?, readOnly?, writeOnly?,
  allowManualEntry, destructive?, hidden?, options: [{value, label}]}`.

Engine limits that suit it: 1 MB of source, 16 MB of heap, about 60 ms to
load and 30 ms a call (the test suite prints the numbers).
