#!/usr/bin/env node
/* eslint-disable no-console */

import {diagnose, encode} from 'cbor2';
import {parseEDN} from '../lib/index.js';
import {u8toHex} from 'cbor2/utils';
import util from 'node:util';

if (process.argv.length < 3) {
  console.error('Usage: edn <EDN literal>');
  process.exit(64);
}
const js = parseEDN(process.argv[2]);
console.log(util.inspect(js, {
  depth: Infinity,
  colors: process.stdout.isTTY,
}));
const bytes = encode(js);
console.log(u8toHex(bytes));
console.log(diagnose(bytes));
