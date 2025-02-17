import {hexToU8, u8toHex} from 'cbor2/utils';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {parse} from '@fast-csv/parse';
import {parseEDN} from '../lib/index.js';
import path from 'node:path';
import {test} from 'node:test';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
const TD = new TextDecoder('utf-8', {
  fatal: true,
});

function testCSVfile(filename) {
  return new Promise((resolve, reject) => {
    let line = 1;
    const stream = parse({
      headers: true,
      ignoreEmpty: true,
      trim: false,
      comment: '#',
    })
      .on('error', reject)
      .on('data', ({op, input, output}) => {
        line++;
        let bytesOrig = null;
        let bytesExpected = null;
        try {
          const obytes = input.match(/^h\](?<hex>[0-9a-f]+)/i);
          if (obytes) {
            input = TD.decode(hexToU8(obytes.groups.hex));
          }
          switch (op) {
            case '=': {
              bytesOrig = parseEDN(input);
              bytesExpected = parseEDN(output);
              assert.deepEqual(bytesOrig, bytesExpected, input);
              break;
            }
            case '-':
              if (output) {
                bytesOrig = parseEDN(input);
                bytesExpected = parseEDN(output, {validateUTF8: true});
                assert.notDeepEqual(
                  bytesOrig,
                  bytesExpected,
                  u8toHex(bytesOrig)
                );
              } else {
                assert.throws(
                  () => parseEDN(input, {validateUTF8: true}),
                  JSON.stringify(input)
                );
              }
              break;
            case 'x': {
              bytesOrig = parseEDN(input);
              bytesExpected = hexToU8(output);
              assert.deepEqual(bytesOrig, bytesExpected, output);
              break;
            }
            default:
              // eslint-disable-next-line no-console
              console.log(`Unknown vector op "${op}"`);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log('CAUGHT', op, JSON.stringify(input), JSON.stringify(output), `at ${filename}:${line}`, {
            bytesOrig,
            bytesExpected,
          });
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

test('edn-test-vectors', () => testDir(
  new URL('../edn-test-vectors/', import.meta.url)
));
