# cbor-edn

Description

## Installation

```sh
npm install cbor-edn
```

## API

Full [API documentation](http://hildjj.github.io/cbor-edn/) is available.

Example:

```js
import {parseEDN} from 'cbor-edn';

const bytes = parseEDN("[_2 h'010203']");
// 9a0000000143010203 in Uint8Array
```

## Command Line

The CLI version of cbor-edn is useful only for diagnostic purposes. Usage:

```
edn [options] [diagnosticNotationString]

Positional:
 diagnosticNotationString The string to parse.  If not given, reads from stdin.

Options:
 -a,--always            Always add encoding indicators when re-encoding.
 -n,--never             Never add encoding indicators when re-encoding.
 -f,--file              Read file as input, if not positional given.
                        If "-", read stdin.  May be given multiple times.
                        Default: "-".
 -s,--startRule <rule>  Entry point for the grammar.  Default: "one_item"
```

Example:

```sh
$ edn "[_2 h'010203']"
bytes: 9a0000000143010203
0x9a0000000143010203
9a 00000001 -- Array (Length: 1 item)
  43        --   [0] Bytes (Length: 3)
    010203

js: [ Uint8Array(3) [ 1, 2, 3 ] ]
diagonstic recreated from js: "[_2 h'010203']"
```

---
[![Build Status](https://github.com/hildjj/cbor-edn/workflows/Tests/badge.svg)](https://github.com/hildjj/cbor-edn/actions?query=workflow%3ATests)
[![codecov](https://codecov.io/gh/hildjj/cbor-edn/graph/badge.svg?token=G5HO3UM734)](https://codecov.io/gh/hildjj/cbor-edn)
