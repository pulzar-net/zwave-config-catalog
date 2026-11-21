# zwave-config-catalog

[![CI](https://github.com/pulzar-net/zwave-config-catalog/actions/workflows/ci.yml/badge.svg)](https://github.com/pulzar-net/zwave-config-catalog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[Z-Wave JS](https://github.com/zwave-js/zwave-js)'s device configuration
lookup, as **one script any JavaScript engine runs**: no Node, no npm, no
filesystem. Give it a device's ids and firmware and the device files it
needs, and it answers what Z-Wave JS would: which configuration file the
device is, and that file read for its firmware, with its parameters, their
options and ranges, and its associations. Nothing is reimplemented: it is
`@zwave-js/config`'s own `ConfigManager`, over an in-memory filesystem.

Each release of `@zwave-js/config` is published as a release here the day
it comes out, with the resolver, the device index as Z-Wave JS builds it,
and which files each device file reads. The device files themselves stay
upstream's.

**[The format](FORMAT.md)** | **[Releases](https://github.com/pulzar-net/zwave-config-catalog/releases)** |
**[Served files](https://oss.pulzr.net/zwave-config-catalog/versions.json)**

## Why

Z-Wave JS's configuration database is the most complete record of how Z-Wave
devices are configured: over 3,000 devices, with parameters that change by
firmware version. Reading it right means its own rules for picking a file,
importing templates and evaluating conditions. A service in another language,
or a sandbox with no filesystem, can run those rules here instead of porting
them.

## How it is checked

On every release, before anything is published, the resolver runs in QuickJS
against Z-Wave JS in Node: a Zooz ZSE40 and an Aeotec ZW100, whose settings
differ by firmware, and then every device of the release at both ends of its
firmware range, compared parameter by parameter.

## Develop

```sh
npm ci
npm test            # build a release from the pinned package and test it
npm run build       # write it to site/v/<version>/
```

## Licence

MIT, as Z-Wave JS is. The resolver contains `@zwave-js/config`,
`@zwave-js/core` and `@zwave-js/shared` (MIT, by AlCalzone and
contributors); the licence is in each release. Maintained by
[Pulzar](https://github.com/pulzar-net).
