import {hexToU8} from 'cbor2/utils';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';
import {testPeggy} from '@peggyjs/coverage';

test('grammar coverage', async() => {
  await testPeggy(new URL('../lib/edn.js', import.meta.url), [
    {
      validInput: '"foo"',
      validResult: hexToU8('63666f6f'),
      peg$maxFailPos: 5,
      invalidInput: '{',
    },
    {
      validInput: '"foo" "bar"',
      validResult: hexToU8('63666f6f63626172'),
      peg$maxFailPos: 11,
    },
    {
      validInput: '"foo" "bar" "baz"',
      validResult: hexToU8('63666f6f636261726362617a'),
      peg$maxFailPos: 17,
    },
    {
      invalidInput: '\\!',
      options: {
        peg$startRuleFunction: 'peg$parseslash_escaped',
      },
    },
    {
      invalidInput: '\\!',
      options: {
        peg$startRuleFunction: 'peg$parsehash_escaped',
      },
    },
    {
      invalidInput: '\x00',
      options: {
        peg$startRuleFunction: 'peg$parsealways_safe',
        peg$silentFails: -1,
      },
    },
    {
      invalidInput: '\ud800\x00',
      options: {
        peg$startRuleFunction: 'peg$parsealways_safe',
        peg$silentFails: -1,
      },
    },
    // HTAB is hoisted, so it gets abandoned
    {
      validInput: '\t',
      options: {
        peg$startRuleFunction: 'peg$parseHTAB',
      },
    },
    {
      invalidInput: '0',
      options: {
        peg$startRuleFunction: 'peg$parseHTAB',
      },
    },
  ]);
});
