import {
  CUSTOM_APP_TAG, ELLIPSE_TAG, IPV4_TAG, IPV6_TAG, MT,
} from './constants.js';
import {Tag, encode} from 'cbor2';
import {base64UrlToBytes, hexToU8, u8concat} from 'cbor2/utils';
import {ByteTree} from './byteTree.js';
import {numToBytes} from './spec.js';

const TD = new TextDecoder('utf-8', {
  fatal: true,
});

export interface StringChunk {
  mt: number; // -1 for unknown app-string
  str: Uint8Array | string;
  spec?: string;
  prefix?: Uint8Array | string;
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
        last.str = u8concat([last.str as Uint8Array, si.str as Uint8Array]);
      }
    } else if (last instanceof ByteTree) {
      si.mt = mode;
      ret.push(si);
    } else {
      last.str = u8concat([last.str as Uint8Array, si.str as Uint8Array]);
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
          TD.decode(x.str as Uint8Array);
        }
        if (mode === MT.ENCODED_BYTES) {
          return new ByteTree(x.str as Uint8Array);
        }
        return new ByteTree(
          numToBytes({int: x.str.length}, x.spec, mode),
          x.str as Uint8Array
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
    TD.decode(x.str as Uint8Array);
  }

  if (mode === MT.ENCODED_BYTES) {
    return new ByteTree(x.str as Uint8Array);
  }
  const bt = new ByteTree(
    numToBytes({int: x.str.length}, x.spec, mode),
    x.str as Uint8Array
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
 * @param prefix DT or dt.
 * @param dt ISO date string.
 * @returns Obj ready for processing with combineStrings.
 */
export function encodeDate(
  prefix: string,
  dt: unknown
): Uint8Array | StringChunk {
  const d = new Date(dt as string);
  const tm = d.getTime() / 1000;
  const str = Number.isSafeInteger(tm) ?
    numToBytes({int: tm}) :
    numToBytes({float: tm});
  if (prefix === 'dt') {
    return {
      mt: MT.ENCODED_BYTES,
      str,
    };
  }
  return {
    mt: MT.ENCODED_BYTES,
    str: new ByteTree(numToBytes({int: 1}, null, MT.TAG), str).bytes(),
  };
}

/**
 * Coalesce all valid bytes together into chunks, and all adjacent ellipses
 * into a single ellipsis.
 *
 * @param _prefix Ignored.
 * @param chunks Chunks.
 * @returns Coalesced array.
 */
export function encodeHex(
  _prefix: string,
  chunks: unknown
): Uint8Array | (StringChunk | ByteTree)[] {
  const str = chunks as (string | ByteTree)[];
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
 * @param prefix IP or ip.
 * @param str Array of [IPbytes, number].
 * @returns Chunk with either the address or [mask, address] pre-encoded,
 *   as well as v set.
 */
export function encodeIP(prefix: string, str: unknown): StringChunk {
  const [addr, mask] = str as [IPbytes, number?];

  let inside: StringChunk | null = null;
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

    inside = {
      mt: MT.ENCODED_BYTES,
      str: encode([mask, bytes]),
      v: addr.v,
    };
  } else {
    inside = {
      mt: MT.ENCODED_BYTES,
      str: encode(addr.bytes),
      v: addr.v,
    };
  }
  if (prefix === 'ip') {
    return inside;
  }
  return {
    mt: MT.ENCODED_BYTES,
    str: new ByteTree(
      numToBytes({int: (addr.v === 4) ? IPV4_TAG : IPV6_TAG}, null, MT.TAG),
      inside.str as Uint8Array
    ).bytes(),
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

function encodeB64(_prefix: string, b64: unknown): Uint8Array {
  const b = (b64 as string[]).flat(Infinity).join('');
  return base64UrlToBytes(b);
}

export type ParsedAppStrFunc = (
  prefix: string,
  parsed: unknown
) => Uint8Array | StringChunk | ChunkTree | (StringChunk | ByteTree)[];

export type PossibleResults
  = [rule: string, ParsedAppStrFunc?]
  | [rule: null, StringChunk | ChunkTree | Uint8Array];

export type AppStrFunc = (
  prefix: string,
  str: string
) => PossibleResults;

const knownTypes = new Map<string, AppStrFunc>();

/**
 * Register an app-string decoder.
 *
 * @param prefix The string before the first squote.
 * @param fun Function to process the string.
 */
export function registerAppString(
  prefix: string,
  fun: AppStrFunc | null | undefined
): void {
  if (fun) {
    knownTypes.set(prefix, fun);
  } else {
    knownTypes.delete(prefix);
  }
}

registerAppString('h', () => ['app_string_h', encodeHex]);
registerAppString('b64', () => ['app_string_b64', encodeB64]);
registerAppString('dt', () => ['date_time', encodeDate]);
registerAppString('DT', () => ['date_time', encodeDate]);
registerAppString('ip', () => ['app_string_ip', encodeIP]);
registerAppString('IP', () => ['app_string_ip', encodeIP]);

/**
 * Two-step processing for app-string plugins.  If the first step returns null
 * for the first item in the array, decoding happens all in the first step.
 * Otherwise, return `[grammarRuleName, callback]`. The named grammar
 * rule will be called, and the results passed to `callback(prefix, results)`.
 *
 * @param prefix Results of app_prefix.
 * @param str The matched sqstr, with squotes unescaped.
 * @returns One of the possible approaches.
 */
export function parseAppString(
  prefix: string,
  str: string
): PossibleResults {
  const fun = knownTypes.get(prefix);
  if (!fun) {
    return [
      null, {
        mt: MT.CUSTOM,
        prefix,
        str,
      },
    ];
  }
  return fun(prefix, str);
}
