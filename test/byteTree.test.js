import {ByteTree} from '../lib/byteTree.js';
import assert from 'node:assert/strict';
import {hexToU8} from 'cbor2/utils';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';
import util from 'node:util';

test('ByteTree', () => {
  let bt = new ByteTree();
  assert.deepEqual(bt.bytes(), hexToU8(''));

  bt = new ByteTree(hexToU8(''));
  assert.deepEqual(bt.bytes(), hexToU8(''));

  bt = new ByteTree(hexToU8('0102'));
  assert.deepEqual(bt.bytes(), hexToU8('0102'));

  bt = new ByteTree(bt, hexToU8('0304'), bt);
  assert.deepEqual(bt.bytes(), hexToU8('010203040102'));

  bt = new ByteTree([bt, bt]);
  assert.deepEqual(bt.bytes(), hexToU8('010203040102010203040102'));

  bt.push(hexToU8('ff'));
  assert.deepEqual(bt.bytes(), hexToU8('010203040102010203040102ff'));

  assert.equal(
    bt.toString(),
    'ByteTree(13)[ByteTree(6)[ByteTree(2)[0x0102], 0x0304, ByteTree(2)[0x0102]],ByteTree(6)[ByteTree(2)[0x0102], 0x0304, ByteTree(2)[0x0102]], 0xff]'
  );
  assert.equal(
    util.inspect(bt),
    'ByteTree(13)[ByteTree(6)[ByteTree(2)[0x0102], 0x0304, ByteTree(2)[0x0102]],ByteTree(6)[ByteTree(2)[0x0102], 0x0304, ByteTree(2)[0x0102]], 0xff]'
  );
});
