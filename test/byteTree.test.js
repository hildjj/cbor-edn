import {getRanges, hexToU8} from 'cbor2/utils';
import {ByteTree} from '../lib/byteTree.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import util from 'node:util';

test('ByteTree', () => {
  let bt = new ByteTree();
  assert.deepEqual(bt.bytes(), hexToU8(''));

  bt = new ByteTree(hexToU8(''));
  assert.deepEqual(bt.bytes(), hexToU8(''));
  assert.equal(util.inspect(bt), 'ByteTree(0)[""]');

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

  assert.throws(() => {
    const b = new ByteTree('foo');
    b.bytes();
  });

  assert.throws(() => {
    const b = new ByteTree();
    b.push('foo');
    b.bytes();
  });
});

test('ByteTree regions', () => {
  const bt = new ByteTree(new Uint8Array([1, 2, 3]));
  bt.setRegion('bt');
  const a = new ByteTree();
  a.push(new Uint8Array([0]));
  a.push(bt);
  a.push(new Uint8Array([4, 5]));
  a.push(bt);
  const b = a.bytes();
  assert.deepEqual(getRanges(b), [[0, 1], [1, 3, 'bt'], [4, 2], [6, 3, 'bt']]);

  assert.throws(() => {
    const c = new ByteTree();
    c.setRegion('b');
    c.push('foo');
  });
});
