import concat from "../util/binary";
import { Chunk } from "./parse"

const TAG_SIZE = 0xFFFFFF;

export default (chunk: Chunk, priviousTagSize: number): ArrayBuffer[] => {
  if (
    chunk.message_type_id !== 8 &&
    chunk.message_type_id !== 9
  ) { return []; }

  const chunks: ArrayBuffer[] = [];
  const message = new Uint8Array(concat(... chunk.message));
  
  for (let i = 0, begin = 0; begin < message.byteLength; i += 1, begin += TAG_SIZE) {
    const length = Math.min(message.byteLength - begin, TAG_SIZE);
    const buffer = new ArrayBuffer(length + 4 + 11)
    const view = new DataView(buffer);

    // prevTagSize
    view.setUint32(0, priviousTagSize, false)
    // tag
    view.setUint8(4 + 0, chunk.message_type_id);
    // dataSize
    view.setUint8(4 + 1, (length & 0xFF0000) >> 16);
    view.setUint8(4 + 2, (length & 0x00FF00) >> 8);
    view.setUint8(4 + 3, (length & 0x0000FF) >> 0);
    // ts
    view.setUint8(4 + 4, ((chunk.timestamp + i) & 0x00FF0000) >> 16);
    view.setUint8(4 + 5, ((chunk.timestamp + i) & 0x0000FF00) >> 8);
    view.setUint8(4 + 6, ((chunk.timestamp + i) & 0x000000FF) >> 0);
    view.setUint8(4 + 7, ((chunk.timestamp + i) & 0xFF000000) >> 24);
    // streamId
    view.setUint8(4 + 8, 0);
    view.setUint8(4 + 9, 0);
    view.setUint8(4 + 10, 0);
    // content
    for (let i = 0; i < length; i++) {
      view.setUint8(i + 4 + 11, message[begin + i]);
    }

    chunks.push(buffer);
  }
  
  return chunks;
}