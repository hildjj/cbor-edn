import {assert} from '../lib/assert.js';
import nas from 'node:assert/strict';
import test from 'node:test';

test('assert', () => {
  nas.doesNotThrow(() => assert(true));
  nas.throws(() => assert(false), /invalid/);
  nas.throws(() => assert(false, 'TEST'), /TEST/);
  nas.throws(() => assert(false, new Error('BOOP')), /BOOP/);
});
