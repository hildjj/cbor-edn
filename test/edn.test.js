// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';
import {testPeggy} from '@peggyjs/coverage';

test('grammar coverage', async() => {
  await testPeggy(new URL('../lib/edn.js', import.meta.url), [
    {
      validInput: '"foo"',
      validResult: ['foo'],
      peg$maxFailPos: 5,
      invalidInput: '{',
    },
    {
      validInput: '"foo" "bar"',
      validResult: ['foo', 'bar'],
      peg$maxFailPos: 11,
    },
    {
      validInput: '"foo" "bar" "baz"',
      validResult: ['foo', 'bar', 'baz'],
      peg$maxFailPos: 17,
    },
  ]);
});
