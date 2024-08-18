#!/usr/bin/env -S node --enable-source-maps
/* eslint-disable no-console */

import {comment, decode, diagnose} from 'cbor2';
import fs from 'node:fs';
import {parseEDN} from '../lib/index.js';
import {u8toHex} from 'cbor2/utils';
import util from 'node:util';

const inp = (process.argv.length < 3) ?
  fs.readFileSync(0, 'utf8') :
  process.argv[2];
const colors = process.stdout.isTTY;

const bytes = parseEDN(inp);
console.log('bytes:', u8toHex(bytes));
console.log(comment(bytes));

const js = decode(bytes);
console.log('js:', util.inspect(js, {
  depth: Infinity,
  colors,
}));
console.log(
  'diagonstic recreated from js:',
  util.inspect(diagnose(bytes), {colors})
);
