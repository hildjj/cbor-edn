export type ByteItem = ByteTree | Uint8Array;

export class ByteTree {
  #length = 0;
  #trees: ByteItem[] = [];

  public constructor(...item: ByteItem[]) {
    this.#trees = item;
    this.#length = this.#trees.reduce((t, v) => t + v.length, 0);
  }

  public get length(): number {
    return this.#length;
  }

  public bytes(into?: Uint8Array, offset = 0): Uint8Array {
    into ??= new Uint8Array(this.#length);
    for (const t of this.#trees) {
      if (t instanceof ByteTree) {
        t.bytes(into, offset);
      } else {
        into.set(t, offset);
      }
      offset += t.length;
    }
    return into;
  }
}
