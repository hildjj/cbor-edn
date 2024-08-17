import {ByteTree} from '../lib/byteTree.js';
import assert from 'node:assert/strict';
import {hexToU8} from 'cbor2/utils';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';

test('ByteTree', () => {
  let bt = new ByteTree();
  assert.deepEqual(bt.bytes(), hexToU8(''));

  bt = new ByteTree(hexToU8(''));
  assert.deepEqual(bt.bytes(), hexToU8(''));

  bt = new ByteTree(hexToU8('0102'));
  assert.deepEqual(bt.bytes(), hexToU8('0102'));

  bt = new ByteTree(bt, hexToU8('0304'), bt);
  assert.deepEqual(bt.bytes(), hexToU8('010203040102'));
});
