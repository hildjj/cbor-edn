#!/usr/bin/env -S node --enable-source-maps
/* eslint-disable no-console */

import {DiagnosticSizes, comment, decode, diagnose} from 'cbor2';
import {ByteTree} from '../lib/byteTree.js';
import fs from 'node:fs';
import {parseEDN} from '../lib/index.js';
import {u8toHex} from 'cbor2/utils';
import util from 'node:util';

// eslint-disable-next-line n/no-unsupported-features/node-builtins
const opts = util.parseArgs({
  strict: true,
  allowPositionals: true,
  options: {
    startRule: {
      short: 's',
      type: 'string',
      default: 'one_item',
    },
    never: {
      short: 'n',
      type: 'boolean',
      default: false,
    },
    always: {
      short: 'a',
      type: 'boolean',
      default: false,
    },
  },
});

const inputs = (opts.positionals.length < 1) ?
  [fs.readFileSync(0, 'utf8')] :
  opts.positionals;
const colors = process.stdout.isTTY;

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

for (const inp of inputs) {
  const bytes = parseEDN(inp, {
    startRule: opts.values.startRule,
  });
  if (bytes instanceof Uint8Array) {
    console.log('bytes:', u8toHex(bytes));
    console.log(comment(bytes));

    const js = decode(bytes);
    console.log('js:', util.inspect(js, {
      depth: Infinity,
      colors,
    }));
    let diagnosticSizes = DiagnosticSizes.PREFERRED;
    if (opts.values.never) {
      diagnosticSizes = DiagnosticSizes.NEVER;
    }
    if (opts.values.always) {
      diagnosticSizes = DiagnosticSizes.ALWAYS;
    }

    console.log(
      'diagonstic recreated from js:',
      util.inspect(diagnose(bytes, {
        diagnosticSizes,
      }), {colors})
    );
  } else {
    console.log('js:', util.inspect(decodeU8(bytes), {
      depth: Infinity,
      colors,
    }));
  }
  console.log();
}
