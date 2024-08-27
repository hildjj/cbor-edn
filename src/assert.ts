/**
 * Pulled in here to keep this project web-safe.
 *
 * @param value Value to check.
 * @param message Message to throw if invalid.
 * @throws If !value.
 */
export function assert(
  value: unknown, message?: string | Error
): asserts value {
  if (!value) {
    if (message) {
      if (message instanceof Error) {
        throw message;
      }
      throw new Error(message);
    }
    throw new Error(`${value} invalid`);
  }
}
