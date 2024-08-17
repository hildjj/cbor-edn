import {
  type DecodeOptions,
  type EncodeOptions,
  defaultDecodeOptions,
  defaultEncodeOptions,
} from 'cbor2';
// eslint-disable-next-line n/no-missing-import
import {type SyntaxError, parse} from '../lib/edn.js';

const source = 'parseEDN';

export interface EDNoptions {
  decodeOptions: DecodeOptions;
  encodeOptions: EncodeOptions;
}

/**
 * Parse a CBOR Extended Diagnostic Notation (EDN) string.
 *
 * @param edn String to parse.
 * @param opts Encode and decode options.
 * @returns Best approximation in JS of the parsed EDN.
 * @throws On syntax error.
 */
export function parseEDN(
  edn: string,
  opts: EDNoptions = {
    decodeOptions: defaultDecodeOptions,
    encodeOptions: defaultEncodeOptions,
  }
): unknown {
  try {
    return parse(edn, {
      startRule: 'one_item',
      grammarSource: source,
      ...opts,
    });
  } catch (e) {
    const ef = e as SyntaxError;
    if (typeof ef.format === 'function') {
      // @ts-expect-error message is not readonly
      ef.message = ef.format([{source, text: edn}]);
    }
    throw e;
  }
}
