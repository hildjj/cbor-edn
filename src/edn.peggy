{{
import {
  encode, encodedNumber, getEncoded, saveEncodedLength, Simple, Tag
} from 'cbor2';
import {base64UrlToBytes, hexToU8, u8concat, u8toHex} from 'cbor2/utils';

function deHex(str) {
  return String.fromCodePoint(parseInt(str, 16));
}

function specBox(n, spec, mt = 0, float=false) {
  if (spec == null) {
    return n;
  }
  if (float) {
    switch (spec) {
      case '1':
        return encodedNumber(n, 'f16');
      case '2':
        return encodedNumber(n, 'f32');
      case '3':
        return encodedNumber(n, 'f64');
      default:
        error(`Invalid float spec: _${spec}`);
    }
  } else {
    switch (spec) {
      case 'i':
        return encodedNumber(n, 'i0', mt);
      case '0':
        return encodedNumber(n, 'i8', mt);
      case '1':
        return encodedNumber(n, 'i16', mt);
      case '2':
        return encodedNumber(n, 'i32', mt);
      case '3':
        return encodedNumber(n, 'i64', mt);
      default:
        error(`Invalid integer spec: _${spec}`);
    }
  }
}
}}

seq
  = S items:(first:item S rest:(OC @item S)* OC { return [first, ...rest]; })? {
    return items ?? [];
  }

one_item
  = S @item S

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
    const obj = (options.decodeOptions.preferMap || ents.every(([k]) => typeof k === 'string')) ?
      Object.fromEntries(ents) :
      new Map(ents);
    if (spec) {
      const len = specBox(ents.length, spec, 5);
      saveEncodedLength(obj, getEncoded(len));
    }
    return obj;
  }

array
  = "[" spec:spec S items:(first:item S rest:(OC @item S)* OC { return [first, ...rest]; })? "]" {
    const a = items ?? [];
    if (spec) {
      const len = specBox(a.length, spec, 4);
      saveEncodedLength(a, getEncoded(len));
    }
    return a;
  }

tagged
  = n:uint spec:spec "(" S item:item S ")" {
    const tag = new Tag(specBox(n, spec, 6), item);
    return tag.decode(options.decodeOptions);
  }

number
  = n:(basenumber / decnumber / infin) spec:spec {
    return specBox(n, spec, 0, text().includes('.'));
  }

simple
  = "false" { return false }
  / "true" { return true }
  / "null" { return null }
  / "undefined" { return undefined }
  / "simple(" S i:item S ")" { return new Simple(i); } // TODO: Add .decode()

string
  = s:string1e|1.., S "+" S| {
    if (s.every(str => typeof str === 'string')) {
      return s.reduce((t, v) => t + v, '');
    }
    if (s.every(buf => buf instanceof Uint8Array)) {
      return u8concat(s);
    }
    if (s.every(other => other.prefix === s[0].prefix)) {
      return {
        ...s[0],
        str: s.reduce((t, v) => t + v.str, ''),
      }
    }
    return s;
  }

streamstring
  = "(_" S first:string S next:(OC @string S)* OC ")" {
    return [first, ...next].reduce((t, v) => t + v, '');
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
  = @item S ":" S @item

uint
  = "0"
  / n:$(DIGIT1 DIGIT*) { return parseInt(n, 10); }

basenumber
  = hexnumber
  / octnumber
  / binnumber

hexnumber
  = sign:sig_mult? "0" "x"i mantInt:$HEXDIG+ suf:(frac:("." @HEXDIG*)? "p"i p:sdigits { return {frac, p} })? {
    let n = parseInt(mantInt, 16);
    if (suf) {
      const pow = suf.p ** 2;
      n *= pow;
      if (suf.frac) {
        for (let i = 0; i < suf.frac.length; i++) {
          n += parseInt(suf.frac[i], 16) * (pow / (16 ** (i + 1)))
        }
      }
    }
    if (typeof sign === 'number') {
      return sign * n;
    }
    return n;
  }
  / sign:sig_mult? "0" "x"i "." frac:HEXDIG+ "p"i p:sdigits {
    let n = 0;
    const pow = 2 ** p;
    for (let i = 0; i < frac.length; i++) {
      n += parseInt(frac[i], 16) * (pow / (16 ** (i + 1)));
    }
    if (typeof sign === 'number') {
      return sign * n;
    }
    return n;
  }

sdigits
  = n:$(sign? DIGIT+) { return parseInt(n) }

octnumber
  = n:(@sign? "0" "o"i @ODIGIT+) {
    return parseInt(n.flat().join(''), 8);
  }

binnumber
  = n:(@sign? "0" "b"i @BDIGIT+) {
    return parseInt(n.flat().join(''), 2);
  }

decnumber
  = n:$(sign? (DIGIT+ ("." DIGIT*)? / "." DIGIT+) ("e"i sign? DIGIT+)?) {
    return parseFloat(n);
  }

infin
  = "Infinity" { return Infinity }
  / "-Infinity" { return -Infinity }
  / "NaN" { return NaN }

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

sig_mult
  = "+" { return 1 }
  / "-" { return -1 }

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
  = str:(tstr / bstr) spec:spec {
    if (spec) {
      let mt = 2;
      if (typeof str === 'string') {
        str = Object(str);
        mt = 3;
      }
      const len = specBox(str.length, spec, mt);
      saveEncodedLength(str, getEncoded(len));
    }
    return str;
  }

ellipsis
  = $"."|3..|

lcalnum
  = lcalpha
  / DIGIT

ucalpha
  = [\x41-\x5a]

tstr
  = DQUOTE dq:double_quoted* DQUOTE { return dq.join('') }

bstr
  = app_string
  / sqstr
  / embedded

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
      return hexToU8(str);
    case 'b64':
      return base64UrlToBytes(str);
    default:
      return {type: 'app-string', prefix, str}
    }
  }

sqstr
  = "'" sq:single_quoted* "'" { return sq.join('') }

embedded
  = "<<" seq:seq ">>" {
    const bytes = seq.map(b => encode(b));
    return u8concat(bytes);
  }

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
  / "A"i
  / "B"i
  / "C"i
  / "D"i
  / "E"i
  / "F"i

EOF = !.
