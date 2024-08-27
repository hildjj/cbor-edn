import {encode, encodedNumber, getEncoded} from 'cbor2';
import {MT} from './constants.js';
import {assert} from './assert.js';

export interface IntNumber {
  int: number;
}
export interface FloatNumber {
  float: number;
}
export type TypedNumber = IntNumber | FloatNumber;

/**
 * Encode a number as a Uint8Array.
 *
 * @param n Int or Float to encode.
 * @param spec '' for indefinite, null for default, '0' for one-byte, etc.
 * @param mt Major type to add to integer.
 * @returns Encoded number.
 * @throws On invlid state.
 */
export function numToBytes(
  n: TypedNumber,
  spec?: string | null | undefined,
  mt = MT.POS_INT
): Uint8Array {
  let num = null;

  if ('float' in n) {
    // Ignore mt
    switch (spec) {
      case null:
      case undefined:
        return encode(n.float, {avoidInts: true}); // Force preferred float
      case '1':
        num = encodedNumber(n.float, 'f16');
        break;
      case '2':
        num = encodedNumber(n.float, 'f32');
        break;
      case '3':
        num = encodedNumber(n.float, 'f64');
        break;
      default:
        throw new Error(`Invalid float spec: _${spec}`);
    }
  } else {
    switch (spec) {
      case null:
      case undefined:
        num = encodedNumber(n.int, 'i', mt);
        break;
      case '':
        return new Uint8Array([0x1f | (mt << 5)]);
      case 'i':
        num = encodedNumber(n.int, 'i0', mt);
        break;
      case '0':
        num = encodedNumber(n.int, 'i8', mt);
        break;
      case '1':
        num = encodedNumber(n.int, 'i16', mt);
        break;
      case '2':
        num = encodedNumber(n.int, 'i32', mt);
        break;
      case '3':
        num = encodedNumber(n.int, 'i64', mt);
        break;
      default:
        throw new Error(`Invalid integer spec: _${spec} for ${JSON.stringify(n)}`);
    }
  }

  const enc = getEncoded(num);
  assert(enc);
  return enc;
}
