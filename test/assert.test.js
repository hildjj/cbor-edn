import {assert} from '../lib/assert.js';
import nas from 'node:assert/strict';

// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';

test('assert', () => {
  nas.doesNotThrow(() => assert(true));
  nas.throws(() => assert(false), /invalid/);
  nas.throws(() => assert(false, 'TEST'), /TEST/);
  nas.throws(() => assert(false, new Error('BOOP')), /BOOP/);
});
