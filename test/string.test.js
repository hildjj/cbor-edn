import {ByteTree} from '../lib/byteTree.js';
import {MT} from '../lib/constants.js';
import assert from 'node:assert/strict';
import {combineStrings} from '../lib/string.js';
import {encode} from 'cbor2';
import test from 'node:test';

const NULL = encode(null);
const TE = new TextEncoder();

test('combineStrings', () => {
  assert.throws(() => {
    combineStrings([{
      mt: MT.CUSTOM,
      str: TE.encode('test'),
    }]);
  }, /Invalid prefix/);

  assert.doesNotThrow(() => {
    combineStrings([{
      mt: MT.UTF8_STRING,
      str: new Uint8Array([0xc0]),
    }]);
  });

  assert.throws(() => {
    combineStrings([{
      mt: MT.UTF8_STRING,
      str: new Uint8Array([0xc0]),
    }], {
      validateUTF8: true,
    });
  }, /The encoded data was not valid for encoding utf-8/);

  assert.throws(() => {
    combineStrings([{
      mt: MT.UTF8_STRING,
      str: new Uint8Array([0x64]),
    }, {
      mt: MT.UTF8_STRING,
      str: new Uint8Array([0xc0]),
    }], {
      validateUTF8: true,
    });
  }, /The encoded data was not valid for encoding utf-8/);

  assert.throws(() => {
    const bt = new ByteTree(NULL);
    bt.mt = MT.ELLIPSIS;
    combineStrings([bt, {
      mt: MT.UTF8_STRING,
      str: new Uint8Array([0xc0]),
    }], {
      validateUTF8: true,
    });
  }, /The encoded data was not valid for encoding utf-8/);
});
