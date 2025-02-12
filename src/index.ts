import {
  type GrammarSource,
  type GrammarSourceObject,
  type Location,
  type StartRuleNames,
  type SyntaxError,
  parse,
} from '../lib/edn.js';

export {version} from './version.js';

const source = 'parseEDN';

export {
  GrammarSource,
  GrammarSourceObject,
  Location,
  StartRuleNames,
};

export interface EDNoptions {

  /** These are passed along to the grammar.  Never needed. */
  [key: string]: unknown;

  /** Start rule.  Sane choices are "seq" and "one-item" (the default). */
  startRule?: StartRuleNames;

  /** Set if parsing from a file to make error messages more helpful. */
  grammarSource?: GrammarSource;

  /** Validate UTF8 for strings. */
  validateUTF8?: boolean;
}

/**
 * Parse a CBOR Extended Diagnostic Notation (EDN) string.
 *
 * @param edn String to parse.
 * @param opts Encode options.
 * @returns Bytes corresponding to the EDN.
 * @throws On syntax error.
 */
export function parseEDN(
  edn: string,
  opts: EDNoptions
): Uint8Array {
  opts = {
    startRule: 'one_item',
    grammarSource: source,
    ...opts,
  };

  try {
    return parse(edn, opts);
  } catch (e) {
    const ef = e as SyntaxError;
    if (typeof ef.format === 'function') {
      // @ts-expect-error message is not readonly
      ef.message = ef.format([{source: opts.grammarSource, text: edn}]);
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
