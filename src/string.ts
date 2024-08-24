import {CUSTOM_APP_TAG, ELLIPSE_TAG, MT} from './constants.js';
import {Tag, encode} from 'cbor2';
import {hexToU8, u8concat} from 'cbor2/utils';
import {ByteTree} from './byteTree.js';
import {numToBytes} from './spec.js';

const TD = new TextDecoder('utf-8', {
  fatal: true,
});

export interface StringChunk {
  mt: number; // -1 for unknown app-string
  str: Uint8Array;
  spec?: string;
  prefix?: Uint8Array;
  v?: 4 | 6; // Only used for IP addresses
}

export type ChunkOrEllipsis
  = StringChunk
  | ByteTree; // If ellipsis

export type ChunkTree = (ChunkOrEllipsis | ChunkTree)[];

function customApp(chunk: StringChunk): ByteTree {
  if (!chunk.prefix) {
    throw new Error('Invalid prefix');
  }
  return new ByteTree(
    encode(new Tag(CUSTOM_APP_TAG, [chunk.prefix, chunk.str]))
  );
}

/**
 * Capture the rules about concatenated bstr's, tstr's, ellipsis, and
 * app-strings.
 *
 * @param chunks The chunks to be combined.
 * @returns Corresponding bytes.
 * @throws On invalid combinations.
 */
export function combineStrings(chunks: ChunkTree): ByteTree {
  // Collapse app-strings as if they were inline.
  const s: ChunkOrEllipsis[] = chunks.flat() as ChunkOrEllipsis[];
  const [first] = s;
  const ret = [first];

  /*
  The mode of the list is the MT of the first non-ellipsis item in the list.
  If the mode is not tstr or bstr, there can be only one non-ellipsis item.
  */
  const elided = s.some(x => x instanceof ByteTree);
  const fne = s.find(x => !(x instanceof ByteTree)) as StringChunk | undefined;
  const mode = fne?.mt ?? MT.ELLIPSIS;
  let found = !(first instanceof ByteTree) && (first.mt === MT.CUSTOM);

  /*
  Coalesce adjacent items of the same type, if possible.
  Possible:
  - Ellipsis <- Ellipsis
  - tstr <- tstr
  - tstr <- bstr (check UTF8)
  - bstr <- bstr
  */
  for (let i = 1; i < s.length; i++) {
    const si = s[i];
    const last = ret[ret.length - 1];
    if (si instanceof ByteTree) {
      if (!(last instanceof ByteTree)) {
        ret.push(si);
      }
    } else if (si.mt === MT.CUSTOM) {
      if ((mode !== MT.CUSTOM) || found) {
        throw new Error('Cannot concat custom app-string');
      }
      ret.push(si);
      found = true;
    } else if (si.mt === MT.UTF8_STRING) {
      if (mode !== MT.UTF8_STRING) {
        throw new Error('Invalid concat, str in non-str mode');
      }
      if (last instanceof ByteTree) {
        ret.push(si);
      } else {
        last.str = u8concat([last.str, si.str]);
      }
    } else if (last instanceof ByteTree) {
      si.mt = mode;
      ret.push(si);
    } else {
      last.str = u8concat([last.str, si.str]);
    }
  }

  // Output
  if (elided) {
    if (ret.length === 1) {
      // Only one ...
      return ret[0] as ByteTree;
    }
    // Output 888(ret)
    return new ByteTree(
      numToBytes({int: ELLIPSE_TAG}, null, MT.TAG),
      numToBytes({int: ret.length}, null, MT.ARRAY),
      ret.map(x => {
        if (x instanceof ByteTree) {
          return x;
        }
        if (mode === MT.CUSTOM) {
          return customApp(x);
        }
        if (mode === MT.UTF8_STRING) {
          // Thows if invalid UTF-8.
          TD.decode(x.str);
        }
        if (mode === MT.ENCODED_BYTES) {
          return new ByteTree(x.str);
        }
        return new ByteTree(
          numToBytes({int: x.str.length}, x.spec, mode),
          x.str
        );
      })
    );
  }

  // If not elided, we'll have exactly one entry.
  const x = ret[0] as StringChunk;
  if (mode === MT.CUSTOM) {
    return customApp(x);
  }

  if (mode === MT.UTF8_STRING) {
    // Thows if invalid UTF-8.
    TD.decode(x.str);
  }

  if (mode === MT.ENCODED_BYTES) {
    return new ByteTree(x.str);
  }
  const bt = new ByteTree(
    numToBytes({int: x.str.length}, x.spec, mode),
    x.str
  );
  bt.mt = mode;
  if (x.spec === '') {
    bt.push(new Uint8Array([0xff]));
  }
  return bt;
}

/**
 * Convert string to pre-encoded Uint8Array.
 *
 * @param dt ISO date string.
 * @returns Obj ready for processing with combineStrings.
 */
export function encodeDate(dt: string): Uint8Array {
  const d = new Date(dt);
  const tm = d.getTime() / 1000;
  if (Number.isSafeInteger(tm)) {
    return numToBytes({int: tm});
  }
  return numToBytes({float: tm});
}

/**
 * Coalesce all valid bytes together into chunks, and all adjacent ellipses
 * into a single ellipsis.
 *
 * @param str Chunks.
 * @returns Coalesced array.
 */
export function encodeHex(
  str: (string | ByteTree)[]
): (StringChunk | ByteTree)[] {
  // SQS str:(@(hex_byte / ellipsis) SQS)*
  if (str.length === 0) {
    return [{mt: MT.BYTE_STRING, str: new Uint8Array()}];
  }
  const bytesAndEllipses = str.reduce<(string | ByteTree)[]>((t, v) => {
    if (t.length) {
      const last = t[t.length - 1];
      if ((typeof v === 'string') && (typeof last === 'string')) {
        t[t.length - 1] += v;
        return t;
      } else if ((v instanceof ByteTree) && (last instanceof ByteTree)) {
        // E.g. h'... ...'
        return t;
      }
    }
    t.push(v);
    return t;
  }, []);

  return bytesAndEllipses.map(
    v => (
      (typeof v === 'string') ?
        {mt: MT.BYTE_STRING, str: hexToU8(v)} :
        v
    )
  );
}

export interface IPbytes {
  bytes: Uint8Array;
  v: 4 | 6;
}

/**
 * Given an IPv4 or IPv6 address, possible with a mask, trim the address
 * if needed.
 *
 * @param addr IP address.
 * @param mask If provided, number of bits to mask.
 * @returns Chunk with either the address or [mask, address] pre-encoded,
 *   as well as v set.
 */
export function encodeIP(addr: IPbytes, mask?: number | null): StringChunk {
  if (mask) {
    // Trim length of bytes to mask bits
    const numBytes = Math.ceil(mask / 8);
    let bytes = addr.bytes.slice(0, numBytes);
    const lastByte = bytes[bytes.length - 1];
    if (lastByte !== 0) {
      const numBits = mask % 8;
      if (numBits) {
        bytes[bytes.length - 1] = (lastByte >> numBits) << numBits;
      }
    }
    let count = bytes.length;
    for (let i = bytes.length - 1; i >= 0; i--) {
      if (bytes[i] === 0) {
        count = i;
      } else {
        break;
      }
    }
    bytes = bytes.slice(0, count);

    return {
      mt: MT.ENCODED_BYTES,
      str: encode([mask, bytes]),
      v: addr.v,
    };
  }
  return {
    mt: MT.ENCODED_BYTES,
    str: encode(addr.bytes),
    v: addr.v,
  };
}

/**
 * Convert the parsed version of an IPv6 address into a single buffer.
 *
 * @param bytes Array of '::', bytes as Uint8Array, or an IPv6 address as
 *   IPbytes.
 * @returns IPbytes with v:6.
 */
export function encodeIPv6(bytes: (string | Uint8Array | IPbytes)[]): IPbytes {
  const bf = bytes.map(
    b => (((typeof b !== 'string') && ('bytes' in b)) ? b.bytes : b)
  );

  // Position of the ::
  let cc = -1;
  const byteCount = bf.reduce((t, v, i) => {
    if (v instanceof Uint8Array) {
      t += v.length;
    } else {
      cc = i;
    }
    return t;
  }, 0);
  if (cc >= 0) {
    bf[cc] = hexToU8(''.padStart((16 - byteCount) * 2, '0'));
  }
  return {
    bytes: u8concat(bf as Uint8Array[]),
    v: 6,
  };
}
