import concat from "../util/binary";
import { Chunk } from "./parse"

export default (chunk: Chunk, priviousTagSize: number) => {
  if (
    chunk.message_type_id !== 8 &&
    chunk.message_type_id !== 9
  ) { return null; }

  const message = new Uint8Array(concat(... chunk.message));
  const buffer = new ArrayBuffer(4 + 1 + 3 + 4 + 3 + message.byteLength);
  const view = new DataView(buffer);

  // prevTagSize
  view.setUint32(0, priviousTagSize, false)
  // tag
  view.setUint8(4 + 0, chunk.message_type_id);
  // dataSize
  view.setUint8(4 + 1, (message.byteLength & 0xFF0000) >> 16);
  view.setUint8(4 + 2, (message.byteLength & 0x00FF00) >> 8);
  view.setUint8(4 + 3, (message.byteLength & 0x0000FF) >> 0);
  // ts
  view.setUint8(4 + 4, (chunk.timestamp & 0x00FF0000) >> 16);
  view.setUint8(4 + 5, (chunk.timestamp & 0x0000FF00) >> 8);
  view.setUint8(4 + 6, (chunk.timestamp & 0x000000FF) >> 0);
  view.setUint8(4 + 7, (chunk.timestamp & 0xFF000000) >> 24);
  // streamId
  view.setUint8(4 + 8, 0);
  view.setUint8(4 + 9, 0);
  view.setUint8(4 + 10, 0);
  // content
  for (let i = 0; i < message.byteLength; i++) {
    view.setUint8(i + 4 + 11, message[i]);
  }
  
  return buffer;
}