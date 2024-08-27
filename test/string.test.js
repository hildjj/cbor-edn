import {MT} from '../lib/constants.js';
import assert from 'node:assert/strict';
import {combineStrings} from '../lib/string.js';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';

test('combineStrings', () => {
  assert.throws(() => {
    combineStrings([{
      mt: MT.CUSTOM,
      str: 'test',
    }]);
  }, /Invalid prefix/);
});
