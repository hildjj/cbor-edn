import {
  type CborRange,
  getRanges, hasRanges, setRanges,
  u8toHex,
} from 'cbor2/utils';
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
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    } else if (t instanceof ByteTree) {
      t.bytes(into, offset);
      offset += t.length;
    }
    // Impossible to have invalid entry since all pathways are checked in
    // hasRegions.
  }
  return offset;
}

function hasRegions(item: ByteItem): boolean {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  if (item instanceof ByteTree) {
    return item.hasRegions;
  }
  if (Array.isArray(item)) {
    return item.some(hasRegions);
  }
  if (item instanceof Uint8Array) {
    return hasRanges(item);
  }
  throw new Error(`Invalid ByteTree item: ${item}`);
}

function getRegions(item: ByteItem, offset: number): CborRange[] {
  if (Array.isArray(item)) {
    const ret: CborRange[] = [];
    for (const i of item) {
      const r = getRegions(i, offset);
      const last = r[r.length - 1];
      offset = last[0] + last[1];
      ret.push(...r);
    }
    if (ret.length === 0) {
      ret.push([offset, 0]);
    }
    return ret;
  }
  if (item instanceof Uint8Array) {
    const r = getRanges(item);
    if (!r) {
      return [[offset, item.length]];
    }
    const ret = [];
    for (const s of r) {
      const t: CborRange = [...s];
      t[0] += offset;
      ret.push(t);
    }
    return ret;
  }
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  if (item instanceof ByteTree) {
    if (item.hasRegions) {
      const ret: CborRange[] = [];
      for (const r of item.regions) {
        const s: CborRange = [...r];
        s[0] += offset;
        ret.push(s);
      }
      return ret;
    }
    return [[offset, item.length]];
  }
  throw new Error(`Invalid ByteTree item: ${item}`);
}

export class ByteTree {
  public mt = 0;
  #length = 0;
  #items: ByteItem[] = [];
  #hasRegions: boolean;
  #regions: CborRange[] = [];

  public constructor(...item: ByteItem[]) {
    this.#items = item;
    this.#length = len(item);
    this.#hasRegions = hasRegions(item);
    if (this.#hasRegions) {
      this.#regions = getRegions(item, 0);
    }
  }

  public get length(): number {
    return this.#length;
  }

  public get hasRegions(): boolean {
    return this.#hasRegions;
  }

  public get regions(): CborRange[] {
    return this.#regions;
  }

  public setRegion(type?: string): void {
    this.#hasRegions = true;
    this.#regions.push([0, this.#length, type]);
  }

  public bytes(into?: Uint8Array, offset = 0): Uint8Array {
    if (!into) {
      if (this.#hasRegions) {
        // Always copy if there are regions
        into = new Uint8Array(this.#length);
        setRanges(into, this.#regions);
      } else if (
        (this.#items.length === 1) &&
        (this.#items[0] instanceof Uint8Array)
      ) {
        // Shortcut, don't copy
        return this.#items[0];
      } else {
        into = new Uint8Array(this.#length);
      }
    }
    allBytes(into, offset, this.#items);
    return into;
  }

  public push(...item: ByteItem[]): void {
    this.#items.push(...item);
    if (this.#hasRegions) {
      this.#regions.push(...getRegions(item, this.#length));
    } else if (hasRegions(item)) {
      this.#hasRegions = true;
      this.#regions = getRegions(this.#items, 0);
    }
    this.#length += len(item);
  }

  public [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString();
  }

  public toString(): string {
    let ret = 'ByteTree(';
    ret += this.#length;
    ret += ')[';
    ret += this.#items.map(i => {
      if (i instanceof Uint8Array) {
        if (i.length) {
          return `0x${u8toHex(i)}`;
        }
        return '""';
      }
      return String(i);
    }).join(', ');
    ret += ']';
    return ret;
  }
}
