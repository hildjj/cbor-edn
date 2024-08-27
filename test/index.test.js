import {parseEDN, registerAppString} from '../lib/index.js';
import assert from 'node:assert/strict';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import test from 'node:test';
import {u8toHex} from 'cbor2/utils';

test('failures', () => {
  for (const invalid of [
    // Only things that would require WTF-8 to store in CSV
    '/ foo\uD83D /',
    '#\uD83D',
    '"\uDCA9"',
    '"\uD83D"',
    '"\\uDCA9"',
    '"\\uD83D"',
    '"\\uD83D\\"',
    '"\\uD83D\\u"',
    '"\\uD83D\\uDD0"',
    '"\\uD83D\\uD000"',
    '"\\ud9000"',
    '"\\ud90"',
  ]) {
    assert.throws(() => parseEDN(invalid), invalid);
  }
});

test('registerAppString', () => {
  // Before registration, 999(["rot13", "foo"])
  assert.equal(u8toHex(parseEDN("rot13'foo'")), 'd903e78265726f74313363666f6f');
  const orig = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const rot = 'NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm';

  registerAppString(
    'rot13',
    (_prefix, str) => [
      null,
      str.replace(/[a-z]/gi, c => rot[orig.indexOf(c)]),
    ]
  );

  // After registration, rotated string
  assert.equal(u8toHex(parseEDN("rot13'foo'")), '63736262');
  assert.equal(u8toHex(parseEDN("rot13'sbb'")), '63666f6f');

  // Back to original
  registerAppString('rot13');
  assert.equal(u8toHex(parseEDN("rot13'foo'")), 'd903e78265726f74313363666f6f');

  // Invalid rule
  registerAppString('iiii', () => ['__InVaLid__']);
  assert.throws(() => parseEDN("iiii''"), /Invalid start rule/);
});
