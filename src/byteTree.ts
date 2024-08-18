export type ByteItem = ByteTree | ByteItem[] | Uint8Array;

function len(items: ByteItem[]): number {
  let tot = 0;
  for (const i of items) {
    if (Array.isArray(i)) {
      tot += len(i);
    } else {
      tot += i.length;
    }
  }
  return tot;
}

function allBytes(
  into: Uint8Array, offset: number, items: ByteItem[]
): number {
  for (const t of items) {
    if (Array.isArray(t)) {
      offset = allBytes(into, offset, t);
    } else if (t instanceof Uint8Array) {
      into.set(t, offset);
      offset += t.length;
    } else {
      t.bytes(into, offset);
      offset += t.length;
    }
  }
  return offset;
}

export class ByteTree {
  #length = 0;
  #items: ByteItem[] = [];

  public constructor(...item: ByteItem[]) {
    this.#items = item;

    this.#length = len(item);
  }

  public get length(): number {
    return this.#length;
  }

  public bytes(into?: Uint8Array, offset = 0): Uint8Array {
    // Shortcut, don't copy
    if (!into &&
      (this.#items.length === 1) &&
      (this.#items[0] instanceof Uint8Array)) {
      return this.#items[0];
    }
    into ??= new Uint8Array(this.#length);
    allBytes(into, offset, this.#items);
    return into;
  }

  public push(...item: ByteItem[]): void {
    this.#items.push(...item);
    this.#length += len(item);
  }

  public [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString();
  }

  public toString(): string {
    let ret = 'ByteTree(';
    ret += this.#length;
    ret += ')[';
    ret += String(this.#items);
    ret += ']';
    return ret;
  }
}
