import type {FloatNumber} from './spec.js';

/**
 * Generate a floating point number from a parsed hexfloat.
 *
 * @param sign Positive/negative.
 * @param int Integer part.  Either a hex int or "." if there was no leading
 *   zero.
 * @param frac Fractional part, array of individual hex digits.
 * @param exp Exponent, including sign.
 * @returns Floating point equivalent, ready for conversion to binary.
 */
export function hexFloat(
  sign: '+' | '-' | null,
  int: string,
  frac: string[] | null,
  exp: string
): FloatNumber {
  if (int === '.') { // 0x.4p0
    int = '0';
  }
  frac ??= [];

  // Attempt to reduce over/underflows by doing all math at the target
  // power of 2.  This is likely backwards from what is desired at some values
  // of exp.  TODO: see if the C spec has a recommendation.
  const pow = 2 ** parseInt(exp, 10);
  let float = parseInt(int, 16) * pow;
  for (let i = 0; i < frac.length; i++) {
    float += parseInt(frac[i], 16) * (pow / (16 ** (i + 1)));
  }
  if (sign === '-') {
    float *= -1;
  }
  return {float};
}
