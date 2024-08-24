{{
import {encode, Simple, Tag} from 'cbor2';
import {base64UrlToBytes, hexToU8, u8toHex, u8concat} from 'cbor2/utils';
import {ByteTree} from './byteTree.js';
import {
  CUSTOM_APP_TAG, ELLIPSE_TAG, IPV4_TAG, IPV6_TAG, MT
} from './constants.js';
import {numToBytes} from './spec.js';
import {
  combineStrings, encodeDate, encodeHex, encodeIP, encodeIPv6
} from './string.js';
import {hexFloat} from './float.js';

const FALSE = encode(false);
const TRUE = encode(true);
const UNDEFINED = encode(undefined);
const NULL = encode(null);
const BREAK = new Uint8Array([0xff]);
const TE = new TextEncoder();

function deHex(str) {
  return String.fromCodePoint(parseInt(str, 16));
}
}}

seq
  = S items:(first:item S rest:(OC @item S)* OC {
      return new ByteTree(first, rest).bytes()
    })? {
        return items ?? new Uint8Array(0);
      }

one_item
  = S item:item S {
    return new ByteTree(item).bytes();
  }

item
  = map
  / array
  / tagged
  / number
  / simple
  / string
  / streamstring

string1
  = str:tstr spec:spec {
      return {mt: MT.UTF8_STRING, spec, str: TE.encode(str)}
    }
  / str:bstr spec:spec {
      str.spec = spec;
      return str;
    }

string1e
  = string1
  / ellipsis

ellipsis
  = "."|3..| {
    return new ByteTree(
       numToBytes({int: ELLIPSE_TAG}, null, MT.TAG),
      NULL
    );
  }

string
  = s:string1e|1.., S "+" S| {
    return combineStrings(s);
  }

number
  = n:(hexfloat / hexint / octint / binint / decnumber / nonfin) spec:spec {
    return numToBytes(n, spec);
  }

sign
  = "+"
  / "-"

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

hexfloat
  = sign:sign? "0x"i mant:($HEXDIG+ ("." @HEXDIG*)? / "." HEXDIG+) "p"i exp:$(sign? DIGIT+) {
    let [int, frac] = mant;
    return hexFloat(sign, int, frac, exp);
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

nonfin
  = "Infinity" { return {float: Infinity}; }
  / "-Infinity" { return {float: -Infinity}; }
  / "NaN" { return {float: NaN};  }

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

uint
  = "0" { return 0 }
  / n:$(DIGIT1 DIGIT*) { return parseInt(n, 10); }

tagged
  = n:uint spec:spec "(" S item:item S ")" {
    return new ByteTree(
       numToBytes({int: n}, spec, MT.TAG),
      item
    );
  }

app_prefix
  = $(lcalpha lcalnum*)
  / $(ucalpha ucalnum*)

sqstr
  = SQUOTE sq:single_quoted* SQUOTE { return sq.join('') }

bstr
  = str:embedded { return {mt: MT.BYTE_STRING, str}; }
  / s:sqstr { return {mt: MT.BYTE_STRING, str: TE.encode(s)}; }
  / known_app_str
  / ext_app_str

ext_app_str
  = prefix:app_prefix str:sqstr {
    return {mt: MT.CUSTOM, prefix, str};
  }

known_app_str
  = h
  / b64
  / ip
  / dt

invalid_app_str
  = single_quoted* {
    error("Invalid app-string format");
  }

// app-string h
h
  = "h" SQUOTE @valid_h SQUOTE
  / "h" SQUOTE invalid_app_str SQUOTE

valid_h
  = SQS str:(@(hex_byte / ellipsis) SQS)* {
    return encodeHex(str);
  }

// app-string b64
b64
  = "b64" SQUOTE @valid_b64 SQUOTE
  / "b64" SQUOTE @invalid_app_str SQUOTE

valid_b64
  = B b64:(b64_4* (b64_3 / b64_2)?) {
    const b = b64.flat(Infinity).filter(n => n != null).join('');
    return {mt: MT.BYTE_STRING, str: base64UrlToBytes(b)};
  }

b64_4
  = (@b64dig B)|4|

b64_3
  = (@b64dig B)|3| "="? B

b64_2
  = (@b64dig B)|2| ("=" B "=")? B

b64dig
  = ALPHA
  / DIGIT
  / [_+/-]

B
  = iblank* (sq_hash_comment iblank*)*

iblank
  = CR
  / LF
  / SPACE

// app-string dt
dt
  = "dt" SQUOTE dt:date_time SQUOTE {
      return {mt: MT.ENCODED_BYTES, str: encodeDate(dt)};
    }
  / "DT" SQUOTE dt:date_time SQUOTE {
      return {
        mt: MT.ENCODED_BYTES,
        str: new ByteTree(
          numToBytes({int: 1}, null, MT.TAG),
          encodeDate(dt)
        ),
      }
    }
  / ("dt" / "DT") SQUOTE invalid_app_str SQUOTE

full_date
  = date_fullyear "-" date_month "-" date_mday

full_time
  = partial_time time_offset

date_time
  = $(full_date "T"i full_time)

date_fullyear
  = DIGIT|4|

date_month
  = DIGIT|2|

date_mday
  = DIGIT|2|

time_hour
  = DIGIT|2|

time_minute
  = DIGIT|2|

time_second
  = DIGIT|2|

time_secfrac
  = "." DIGIT+

time_numoffset
  = sign time_hour ":" time_minute

time_offset
  = "Z"i
  / time_numoffset

partial_time
  = time_hour ":" time_minute ":" time_second time_secfrac?

// app-string ip
ip
  = typ:("ip" / "IP") SQUOTE inside:valid_ip SQUOTE {
      if (typ === 'ip') {
        return inside;
      }
      return {
        mt: MT.ENCODED_BYTES,
        str: new ByteTree(
          numToBytes({int: (inside.v == 4) ? IPV4_TAG : IPV6_TAG}, null, MT.TAG),
          inside.str,
        ),
      };
    }
  / ("ip" / "IP") SQUOTE invalid_app_str SQUOTE

valid_ip
  = addr:IPaddress mask:("/" @uint)? {
    return encodeIP(addr, mask);
  }

IPaddress
  = IPv4address
  / IPv6address

// ABNF from RFC 3986, re-arranged for PEG compatibility:
IPv6address
  = bytes:((@h16 ":")|6| ls32
  / "::" (@h16 ":")|5| ls32
  / h16? "::" (h16 ":")|4| ls32
  / (h16 (":" h16)?)? "::" (h16 ":")|3| ls32
  / (h16 (":" h16)|..2|)? "::" (h16 ":")|2| ls32
  / (h16 (":" h16)|..3|)? "::" h16 ":" ls32
  / (h16 (":" h16)|..4|)? "::" ls32
  / (h16 (":" h16)|..5|)? "::" h16
  / (h16 (":" h16)|..6|)? "::") {
    return encodeIPv6(bytes.flat(Infinity).filter(b => b && (b != ':')));
  }

h16
  = hex:$HEXDIG|1..4| { return hexToU8(hex.padStart(4, '0')) }

ls32
  = a:h16 ":" b:h16 { return u8concat([a, b]) }
  / IPv4address

IPv4address
  = octets:doctet|4, "."| {
    return {
      bytes: new Uint8Array(octets.map(x => parseInt(x, 10))),
      v: 4,
    };
  }

doctet
  = $("25" [\x30-\x35])
  / $("2" [\x30-\x34] DIGIT)
  / $("1" DIGIT|2|)
  / $([\x31-\x39] DIGIT)
  / DIGIT

tstr
  = DQUOTE dq:double_quoted* DQUOTE { return dq.join('') }

embedded
  = "<<" @seq ">>"

array
  = "[" spec:spec S items:(first:item S rest:(OC @item S)* OC { return [first, ...rest]; })? "]" {
    const ents = items ?? [];
    const t = new ByteTree(
      numToBytes({int: ents.length}, spec, MT.ARRAY),
      ents
    );
    if (spec === '') {
      t.push(BREAK);
    }
    return t;
  }

map
  = "{" spec:spec S entries:(first:kp S rest:(OC @kp S)* OC { return [first, ...rest] })? "}" {
    const ents = entries ?? [];
    const t = new ByteTree( numToBytes({int: ents.length}, spec, MT.MAP), ents);
    if (spec === '') {
      t.push(BREAK);
    }
    return t;
  }

kp
  = key:item S ":" S value:item {
    return new ByteTree(key, value);
  }

// We allow %x09 HT in prose, but not in strings
blank
  = HTAB
  / LF
  / CR
  / SPACE

S
  = blank* (comment blank*)*

// SQS is whitespace/comments inside some single quoted strings
SQS
  = blank* (sq_comment blank*)*

comment
  = "/" non_slash* "/"
  / hash_comment

sq_comment
  = sq_slash_comment
  / sq_hash_comment

slash_comment
  = SLASH non_slash* SLASH

hash_comment
  =  "#" non_lf* ("\n" / EOF)

sq_slash_comment
  = SLASH sq_non_slash* "/"

sq_hash_comment
  = HASH sq_non_lf* (LF / &"'")

non_slash
  = sq_non_slash
  / SQUOTE

sq_non_slash
  = always_safe
  / LF
  / DQUOTE
  / slash_escaped

// Everything but '\n'
non_lf
  = sq_non_lf
  / SQUOTE

sq_non_lf
  = always_safe
  / SLASH
  / DQUOTE
  / hash_escaped

always_safe "plain text"
  = CR
  / [\x20-\x21]
  / [\x23-\x26]
  / [\x28-\x2e]
  / [\x30-\x5b]
  / [\x5d-\ud7ff]
  / [\ue000-\uffff]
  / $([\ud800-\udbff] [\udc00-\udfff])

slash_escaped
  = "\\" (SQUOTE / "/" / escapable)

hash_escaped
  = "\\" (SQUOTE / "\\")

// optional trailing comma (ignored)
OC
  = ("," S)?

streamstring
  = "(_" S first:string S next:(OC @string S)* OC ")" {
    return new ByteTree(
      new Uint8Array([(first.mt << 5) | 0x1f]),
      first,
      next,
      BREAK,
    )
  }

spec
  = ("_" @$wordchar*)?

double_quoted
  = always_safe
  / LF
  / SLASH
  / SQUOTE
  / "\\" @DQUOTE
  / "\\" @escapable

single_quoted
  = always_safe
  / LF
  / SLASH
  / DQUOTE
  / "\\" @SQUOTE
  / "\\" @escapable

escapable
  = "b" { return '\x08' }
  / "f" { return '\x0c' }
  / "n" { return '\n' }
  / "r" { return '\r' }
  / "t" { return '\t' }
  / "/"
  / "\\"
  / "u" @hexchar

hexchar
  = "{" cp:$("0"+ hexscalar? / hexscalar) "}"  { return deHex(cp); }
  / cp:$non_surrogate { return deHex(cp); }
  / hi:high_surrogate "\\" "u" low:low_surrogate { return hi + low }

non_surrogate
  = ((DIGIT / [ABCEF]i) HEXDIG|3|)
  / ("D"i ODIGIT HEXDIG|2|)

high_surrogate
  = cp:$("D"i [89AB]i HEXDIG|2|) { return deHex(cp); }

low_surrogate
  = cp:$("D"i [CDEF]i HEXDIG|2|) { return deHex(cp); }

hexscalar
  = "10" HEXDIG|4|
  / HEXDIG1 HEXDIG|4|
  / non_surrogate
  / HEXDIG|1..3|

CR = "\r" { return '' }
DQUOTE = "\""
HASH = "#"
HTAB = "\t"
LF = "\n"
SLASH = "/"
SPACE = " "
SQUOTE = "'"

DIGIT
  = [\x30-\x39]

DIGIT1
  = [\x31-\x39]

ODIGIT
  = [\x30-\x37]

BDIGIT
  = [\x30-\x31]

HEXDIG
  = DIGIT
  / "A"i
  / "B"i
  / "C"i
  / "D"i
  / "E"i
  / "F"i

HEXDIG1
  = DIGIT1
  / [A-F]i

lcalpha
  = [\x61-\x7a]

lcalnum
  = lcalpha
  / DIGIT

ucalpha
  = [\x41-\x5a]

ucalnum
  = ucalpha
  / DIGIT

ALPHA
  = [A-Z]i

wordchar
  = "_"
  / lcalnum
  / ucalpha

// Added in peggy grammar for utility
hex_byte
  = a:HEXDIG S b:HEXDIG { return a + b }

EOF = !.
