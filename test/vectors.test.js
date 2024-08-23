import {hexToU8, u8toHex} from 'cbor2/utils';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse} from '@fast-csv/parse';
import {parseEDN} from '../lib/index.js';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import {test} from 'node:test';

const TD = new TextDecoder('utf-8', {
  fatal: true,
});

test('vectors', () => {
  const vfile = new URL('../edn-abnf/tests/basic.csv', import.meta.url);

  return new Promise((resolve, reject) => {
    const stream = parse({
      headers: false,
      ignoreEmpty: true,
      trim: true,
    })
      .validate(row => !/^\s*#/.test(row))
      .on('error', reject)
      .on('data', ([op, orig, expected]) => {
        try {
          const obytes = orig.match(/^h\](?<hex>[0-9a-f]+)/i);
          if (obytes) {
            orig = TD.decode(hexToU8(obytes.groups.hex));
          }
          switch (op) {
            case '=': {
              const bytesOrig = parseEDN(orig);
              const bytesExpected = parseEDN(expected);
              assert.deepEqual(bytesOrig, bytesExpected, u8toHex(bytesOrig));
              break;
            }
            case '-':
              if (expected) {
                const bytesOrig = parseEDN(orig);
                const bytesExpected = parseEDN(expected);
                assert.notDeepEqual(
                  bytesOrig,
                  bytesExpected,
                  u8toHex(bytesOrig)
                );
              } else {
                assert.throws(() => parseEDN(orig), JSON.stringify(orig));
              }
              break;
            case 'x': {
              const bytesOrig = parseEDN(orig);
              const bytesExpected = hexToU8(expected);
              assert.deepEqual(bytesOrig, bytesExpected, expected);
              break;
            }
            default:
              // eslint-disable-next-line no-console
              console.log(`Unknown vector op "${op}"`);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log('CAUGHT', op, JSON.stringify(orig), JSON.stringify(expected));
          stream.destroy();
          reject(e);
        }
      })
      .on('end', resolve);

    fs.createReadStream(vfile, 'utf-8').pipe(stream);
  });
});
