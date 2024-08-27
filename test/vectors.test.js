import {hexToU8, u8toHex} from 'cbor2/utils';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {parse} from '@fast-csv/parse';
import {parseEDN} from '../lib/index.js';
import path from 'node:path';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import {test} from 'node:test';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
const TD = new TextDecoder('utf-8', {
  fatal: true,
});

function testCSVfile(filename) {
  return new Promise((resolve, reject) => {
    const stream = parse({
      headers: false,
      ignoreEmpty: true,
      trim: false,
      comment: '#',
    })
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
              assert.deepEqual(bytesOrig, bytesExpected, orig);
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

    fs.createReadStream(filename, 'utf-8').pipe(stream);
  });
}

async function testDir(dir) {
  const d = path.relative(rootDir, fileURLToPath(dir));
  await test(`dir: "${d}"`, async() => {
    const files = await fs.promises.readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.csv')) {
        continue;
      }
      await test(f, () => testCSVfile(new URL(f, dir)));
    }
  });
}

test('local csv', () => testDir(
  new URL('./', import.meta.url)
));

test('from ruby edn-abnf', () => testDir(
  new URL('../edn-abnf/tests/', import.meta.url)
));
