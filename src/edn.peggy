{{
import {
  encode, encodedNumber, getEncoded, saveEncodedLength, Simple, Tag
} from 'cbor2';
import {base64UrlToBytes, hexToU8, u8concat, u8toHex} from 'cbor2/utils';
import {Writer} from 'cbor2/writer';
import {ByteTree} from './byteTree.js';

const ELLIPSE_TAG = 888;
const CUSTOM_APP_TAG = 999;
const FALSE = encode(false);
const TRUE = encode(true);
const UNDEFINED = encode(undefined);
const NULL = encode(null);
const TE = new TextEncoder();

const MT = {
  POS_INT: 0,
  NEG_INT: 1,
  BYTE_STRING: 2,
  UTF8_STRING: 3,
  ARRAY: 4,
  MAP: 5,
  TAG: 6,
  SIMPLE_FLOAT: 7,
};

function deHex(str) {
  return String.fromCodePoint(parseInt(str, 16));
}

function specBox(n, spec, mt = 0) {
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
        return new Uint8Array([0x7f]);
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
  return getEncoded(num);
}

}}

seq
  = S items:(first:item S rest:(OC @item S)* OC { return new ByteTree(first, rest).bytes() })? {
    return items ?? new Uint8Array(0);
  }

one_item
  = S item:item S {
    return new ByteTree(item).bytes();
  }

S
  = blank* (comment blank*)*

item
  = map
  / array
  / tagged
  / number
  / simple
  / string
  / streamstring

OC
  = ("," S)?

blank
  = "\t"
  / "\n"
  / "\r"
  / " "

comment
  = "/" non_slash* "/"
  / "#" non_lf* ("\n" / EOF)

map
  = "{" spec:spec S entries:(first:kp S rest:(OC @kp S)* OC { return [first, ...rest] })? "}" {
    const ents = entries ?? [];
    return new ByteTree(specBox({int: ents.length}, spec, MT.MAP), ents);
  }

array
  = "[" spec:spec S items:(first:item S rest:(OC @item S)* OC { return [first, ...rest]; })? "]" {
    const ents = items ?? [];
    return new ByteTree(specBox({int: ents.length}, spec, MT.ARRAY), ents);
  }

tagged
  = n:uint spec:spec "(" S item:item S ")" {
    return new ByteTree(
      specBox({int: n}, spec, MT.TAG),
      item
    );
  }

number
  = n:(hexfloat / hexint / octint / binint / decnumber / nonfin) spec:spec {
    return specBox(n, spec);
  }

simple
  = "false" { return FALSE }
  / "true" { return TRUE }
  / "null" { return NULL }
  / "undefined" { return UNDEFINED }
  / "simple(" S i:(hexint / octint / binint / decnumber ) S ")" {
    if (!('int' in i)) {
      error(`Expected int in simple, got: "${JSON.stringify(i)}"`);
    }
    if (i.int < 0 || i.int > 255) {
      error(`Simple value must be between 0 and 255, inclusive, got ${i.int}`);
    }
    return encode(new Simple(i.int));
  }

string
  = s:string1e|1.., S "+" S| {
    // s can have {mt, spec, str} or ByteTree (if ...)
    // If s is unknown app-string, it will be mt -1.
    // Coalesce adjacent items of the same type
    const ret = [s[0]]; // Uint8Array changed to {mt:2,str}
    let elided = s[0] instanceof ByteTree;
    let mode = elided ? -2 : (s[0].mt ?? 2);
    for (let i = 1; i < s.length; i++) {
      if (s[i] instanceof ByteTree) {
        elided = true;
        ret.push(s[i]);
      } else if (s[i].mt === -1) {
        if ((mode !== -1) && (ret[ret.length-1] instanceof ByteTree)) {
          ret.push(s[i]);
          mode = -1
        } else {
          throw new Error('Cannot concat custom app-string');
        }
      } else if (s[i].mt === 3) {
        if ((mode !== -2) && (mode !== 3)) {
          throw new Error('Invalid concat, str in non-str mode');
        }
        mode = 3;
        if (ret[ret.length-1] instanceof ByteTree) {
          ret.push(s[i]);
        } else {
          ret[ret.length-1].str = u8concat([ret[ret.length-1].str, s[i].str]);
        }
      } else {
        // Can always add bytes.  Yes, there's supposed to be valid UTF-8
        mode = 2;
        if (ret[ret.length-1] instanceof ByteTree) {
          ret.push(s[i]);
        } else {
          ret[ret.length-1].str = u8concat([ret[ret.length-1].str, s[i].str]);
        }
      }
    }
    if (elided) {
      if (ret.length === 1) {
        // Only ...
        return ret[0];
      }
      return new ByteTree(
        specBox({int: ELLIPSE_TAG}, null, MT.TAG),
        specBox({int: ret.length}, null, MT.ARRAY),
        ret.map(x => {
          if (x instanceof ByteTree) {
            return x;
          }
          if (mode === -1) {
            // Must be the custom app-string
            return new ByteTree(
              specBox({int: CUSTOM_APP_TAG}, null, MT.TAG),
              specBox({int: 2}, null, 4),
              specBox({int: x.prefix.length}, null, MT.UTF8_STRING),
              x.prefix,
              specBox({int: x.str.length}, null, MT.UTF8_STRING),
              x.str
            );
          }
          console.log({mode})
          return new ByteTree(
            specBox({int: x.str.length}, x.spec, mode),
            x.str,
          );
        })
      );
    }

    // If not elided, we'll have exactly one entry.
    const x = ret[0];
    if (mode === -1) {
      return new ByteTree(
        specBox({int: CUSTOM_APP_TAG}, null, MT.TAG),
        specBox({int: 2}, null, MT.ARRAY),
        specBox({int: x.prefix.length}, null, MT.UTF8_STRING),
        x.prefix,
        specBox({int: x.str.length}, null, MT.UTF8_STRING),
        x.str
      );
    }

    const bt = new ByteTree(
      specBox({int: x.str.length}, x.spec, mode),
      x.str
    );
    if (x.spec === '') {
      bt.push(new Uint8Array([0xff]));
    }
    return bt;
  }

streamstring
  = "(_" S first:string S next:(OC @string S)* OC ")" {
    return new ByteTree(
      new Uint8Array([0x7f]),
      first,
      next,
      new Uint8Array([0xff])
    )
  }

non_slash
  = blank
  / [\x21-\x2e]
  / [\x30-\ud7ff]
  / [\ue000-\uffff]
  / $([\ud800-\udbff] [\udc00-\udfff])

non_lf
  = "\t"
  / "\r"
  / [\x20-\ud7ff]
  / [\ue000-\uffff]
  / $([\ud800-\udbff] [\udc00-\udfff])

spec
  = ("_" @$wordchar*)?

kp
  = key:item S ":" S value:item {
    return new ByteTree(key, value);
  }

uint
  = "0" { return 0 }
  / n:$(DIGIT1 DIGIT*) { return parseInt(n, 10); }

hexfloat
  = sign:sign? "0x"i mant:($HEXDIG+ ("." @HEXDIG*)? / "." HEXDIG+) "p"i exp:$(sign? DIGIT+) {
    let [int, frac] = mant;
    if (int === '.') { // 0x.4p0
      int = '0'
    }
    if (frac == null) { // 0x4p0
      frac = [];
    }
    const pow = parseInt(exp, 10) ** 2;
    let float = parseInt(int, 16) * pow;
    for (let i = 0; i < frac.length; i++) {
      float += parseInt(frac[i], 16) * (pow / (16 ** (i + 1)))
    }
    if (sign === '-') {
      float *= -1;
    }
    return {float};
  }

hexint
  = sign:sign? "0x"i dig:$HEXDIG+ {
    return {int: parseInt(`${sign || ''}${dig}`, 16)};
  }

octint
  = sign:sign? "0o"i dig:$ODIGIT+ {
    return {int: parseInt(`${sign || ''}${dig}`, 8)};
  }

binint
  = sign:sign? "0b"i dig:$BDIGIT+ {
    return {int: parseInt(`${sign || ''}${dig}`, 2)};
  }

decnumber
  = n:$(sign? (DIGIT+ ("." DIGIT*)? / "." DIGIT+) ("e"i sign? DIGIT+)?) {
    if (/[\.e]/.test(n) || n === '-0') {
      return {float: parseFloat(n)};
    }
    const b = BigInt(n);
    if (b <= Number.MAX_SAFE_INTEGER && b >= Number.MIN_SAFE_INTEGER) {
      return {int: Number(b)};
    }
    return {int: b};
  }

nonfin
  = "Infinity" { return {float: Infinity}; }
  / "-Infinity" { return {float: -Infinity}; }
  / "NaN" { return {float: NaN};  }

string1e
  = string1
  / ellipsis

wordchar
  = "_"
  / lcalnum
  / ucalpha

DIGIT1
  = [\x31-\x39]

DIGIT
  = [\x30-\x39]

sign
  = "+"
  / "-"

HEXDIG
  = DIGIT
  / "A"i
  / "B"i
  / "C"i
  / "D"i
  / "E"i
  / "F"i

ODIGIT
  = [\x30-\x37]

BDIGIT
  = [\x30-\x31]

string1
  = str:tstr spec:spec {
      return {mt: 3, spec, str: TE.encode(str)}
    }
  / str:bstr spec:spec {
      str.spec = spec;
      return str;
    }

ellipsis
  = "."|3..| {
    return new ByteTree(
      specBox({int: ELLIPSE_TAG}, null, MT.TAG),
      NULL
    );
  }

lcalnum
  = lcalpha
  / DIGIT

ucalpha
  = [\x41-\x5a]

tstr
  = DQUOTE dq:double_quoted* DQUOTE { return dq.join('') }

bstr
  = app_string
  / s:sqstr { return {mt: 2, str: TE.encode(s)}; }
  / str:embedded { return {mt: 2, str}; }

lcalpha
  = [\x61-\x7a]

DQUOTE
  = "\""

double_quoted
  = unescaped
  / "'"
  / "\\" DQUOTE { return '"' }
  / "\\" @escapable

app_string
  = prefix:app_prefix str:sqstr {
    switch (prefix) {
    case 'h':
      return {mt: 2, str: hexToU8(str)};
    case 'b64':
      return {bt: 2, str: base64UrlToBytes(str)};
    default:
      return {mt: -1, prefix: TE.encode(prefix), str: TE.encode(str)}
    }
  }

sqstr
  = "'" sq:single_quoted* "'" { return sq.join('') }

embedded
  = "<<" @seq ">>"

unescaped
  = "\n"
  / "\r"
  / [\x20-\x21]
  / [\x23-\x26]
  / [\x28-\x5b]
  / [\x5d-\ud7ff]
  / [\ue000-\uffff]
  / $([\ud800-\udbff] [\udc00-\udfff])

escapable
  = "b" { return '\x08' }
  / "f" { return '\x0c' }
  / "n" { return '\n' }
  / "r" { return '\r' }
  / "t" { return '\t' }
  / "/"
  / "\\"
  / "u" @hexchar

app_prefix
  = $(lcalpha lcalnum*)
  / $(ucalpha ucalnum*)

single_quoted
  = unescaped
  / DQUOTE
  / "\\" @"'"
  / "\\" @escapable

hexchar
  = "{" cp:$("0"+ hexscalar? / hexscalar) "}"  { return deHex(cp); }
  / cp:$non_surrogate { return deHex(cp); }
  / hi:high_surrogate "\\" "u" low:low_surrogate { return hi + low }

ucalnum
  = ucalpha
  / DIGIT

hexscalar
  = "10" HEXDIG|4|
  / HEXDIG1 HEXDIG|4|
  / non_surrogate
  / HEXDIG|1..3|

non_surrogate
  = ((DIGIT / [ABCEF]i) HEXDIG|3|)
  / ("D"i ODIGIT HEXDIG|2|)

high_surrogate
  = cp:$("D"i [89AB]i HEXDIG|2|) { return deHex(cp); }

low_surrogate
  = cp:$("D"i [CDEF]i HEXDIG|2|) { return deHex(cp); }

HEXDIG1
  = DIGIT1
  / [A-F]i

EOF = !.
