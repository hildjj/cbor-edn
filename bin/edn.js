#!/usr/bin/env -S node --enable-source-maps

import {DiagnosticSizes, comment, decode, diagnose} from 'cbor2';
import {ByteTree} from '../lib/byteTree.js';
import fs from 'node:fs';
import {parseEDN} from '../lib/index.js';
import {u8toHex} from 'cbor2/utils';
import util from 'node:util';

/** @type {import('node:util').ParseArgsConfig.options} */
const options = {
  always: {
    short: 'a',
    type: 'boolean',
    default: false,
    description: 'Always add encoding indicators',
  },
  never: {
    short: 'n',
    type: 'boolean',
    default: false,
    description: 'Never add encoding indicators',
  },
  file: {
    short: 'f',
    type: 'string',
    multiple: true,
    default: ['-'],
    description: 'File to read from if no positional args.  "-" for stdin.',
  },
  startRule: {
    short: 's',
    type: 'string',
    default: 'one_item',
    description: 'Start at this rule for parsing, instead of "seq".',
  },
  help: {
    short: 'h',
    type: 'boolean',
    description: 'Show help for this command',
  },
  verbose: {
    short: 'v',
    type: 'boolean',
    description: 'Verbose output from errors',
  },
};

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const opts = util.parseArgs({
  strict: true,
  allowPositionals: true,
  options,
});

if (opts.values.help) {
  // Janky help
  console.error('edn.js [options] [EDN string]\n');
  for (const [k, v] of Object.entries(options)) {
    const opt = `--${v.short}, --${k}`.padEnd(17, ' ');
    console.error(`${opt}${v.description}`);
  }
  process.exit(64);
}

const colors = process.stdout.isTTY;
let diagnosticSizes = DiagnosticSizes.PREFERRED;
if (opts.values.never) {
  if (opts.values.always) {
    console.error('--never and --always are mutually-exclusive');
    process.exit(1);
  }
  diagnosticSizes = DiagnosticSizes.NEVER;
}
if (opts.values.always) {
  diagnosticSizes = DiagnosticSizes.ALWAYS;
}

const inputs = (opts.positionals.length < 1) ?
  opts.values.file.map(f => fs.readFileSync((f === '-') ? 0 : f, 'utf8')) :
  opts.positionals;

function decodeU8(obj) {
  if (typeof obj === 'object') {
    if (obj instanceof Uint8Array) {
      return `0x${u8toHex(obj)}`;
    }
    if (Array.isArray(obj)) {
      return obj.map(o => decodeU8(o));
    }
    if (obj instanceof Map) {
      const ents = obj.entries();
      return new Map(ents.map(([k, v]) => [k, decodeU8(v)]));
    }
    if (obj instanceof ByteTree) {
      return obj;
    }
    const ents = Object.entries(obj);
    return Object.fromEntries(ents.map(([k, v]) => [k, decodeU8(v)]));
  }
  return obj;
}

try {
  for (const inp of inputs) {
    const bytes = parseEDN(inp, {
      startRule: opts.values.startRule,
    });
    if (bytes instanceof Uint8Array) {
      if (bytes.length > 0) {
        console.log('bytes:', u8toHex(bytes));
        console.log(comment(bytes));

        const js = decode(bytes);
        console.log('js:', util.inspect(js, {
          depth: Infinity,
          colors,
        }));

        console.log(
          'diagonstic recreated from js:',
          util.inspect(diagnose(bytes, {
            diagnosticSizes,
          }), {colors})
        );
      } else {
        console.log('no bytes generated');
      }
    } else {
      console.log('js:', util.inspect(decodeU8(bytes), {
        depth: Infinity,
        colors,
      }));
    }
    console.log();
  }
} catch (e) {
  if (opts.values.verbose) {
    console.log(e);
  } else {
    console.log(e.message);
  }
}
