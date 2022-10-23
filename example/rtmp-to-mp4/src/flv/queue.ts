const FLV_HEADER_SIZE = 9;

export default class FLVQueue {
  #queue: Buffer[] = [];
  #ascendant: Buffer = Buffer.from([]);

  #hasHeader: boolean = false;

  push(chunk: Buffer): void {
    const processing = Buffer.concat([this.#ascendant, chunk]);

    if (!this.#hasHeader && processing.byteLength < FLV_HEADER_SIZE) {
      this.#ascendant = processing;
      return;
    }

    let begin = 0;
    if (!this.#hasHeader) {
      this.#hasHeader = true;
      begin += FLV_HEADER_SIZE;
    }

    while (begin < processing.byteLength) {
      // prevTagSize: 4 bytes
      // streamTypeId: 1 bytes
      // length: 3 bytes
      if (begin + 8 >= processing.byteLength) {
        this.#ascendant = processing.slice(begin);
        return;
      }
      // timestamp: 4 bytes
      // streamId: 3 bytes

      const length = (processing.readUInt8(begin + 5) << 16) | (processing.readUInt8(begin + 6) << 8) | (processing.readUInt8(begin + 7) << 0);
      const next = begin + 4 + 11 + length;
      if (next < processing.byteLength) {
        this.#ascendant = processing.slice(begin);
        return;
      }

      this.#queue.push(processing.slice(begin, next));
      begin = next;
    }
  }

  pop(): Buffer | undefined {
    return this.#queue.shift();
  }

  isEmpty(): boolean {
    return this.#queue.length === 0;
  }

  clear(): void {
   this.#ascendant = Buffer.from([]);
   this.#queue = [];
  } 
}