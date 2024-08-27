import {
  type GrammarSource,
  type GrammarSourceObject,
  type Location,
  type StartRuleNames,
  type SyntaxError,
  parse,

// eslint-disable-next-line n/no-missing-import
} from '../lib/edn.js';

const source = 'parseEDN';

export {
  GrammarSource,
  GrammarSourceObject,
  Location,
  StartRuleNames,
};

export interface EDNoptions {
  [key: string]: unknown;
  startRule?: StartRuleNames;
  grammarSource?: GrammarSource;
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
  opts: EDNoptions
): unknown {
  opts = {
    startRule: 'one_item',
    grammarSource: 'parseEDN',
    ...opts,
  };

  try {
    return parse(edn, opts);
  } catch (e) {
    const ef = e as SyntaxError;
    if (typeof ef.format === 'function') {
      // @ts-expect-error message is not readonly
      ef.message = ef.format([{source, text: edn}]);
    }
    throw e;
  }
}

export type {ByteItem, ByteTree} from './byteTree.js';

export {
  registerAppString,
  type AppStrFunc,
  type ChunkTree,
  type ParsedAppStrFunc,
  type PossibleResults,
  type StringChunk,
  type ChunkOrEllipsis,
} from './string.js';
