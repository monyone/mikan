import concat from "../util/binary";
import { Chunk } from "./parse"

export default (chunk: Chunk) => {
  if (
    chunk.message_type_id !== 8 &&
    chunk.message_type_id !== 9 &&
    chunk.message_type_id !== 8
  ) { return null; }

  const message = new Uint8Array(concat(chunk.message));
  const buffer = new ArrayBuffer(1 + 3 + 4 + 3 + message.byteLength + 4);
  const view = new DataView(buffer);

  // tag
  view.setUint8(0, chunk.message_type_id);
  // dataSize
  view.setUint8(1, (message.byteLength & 0xFF0000) >> 16);
  view.setUint8(2, (message.byteLength & 0x00FF00) >> 8);
  view.setUint8(3, (message.byteLength & 0x0000FF) >> 0);
  // ts
  view.setUint8(4, (chunk.timestamp & 0x00FF0000) >> 16);
  view.setUint8(5, (chunk.timestamp & 0x0000FF00) >> 8);
  view.setUint8(6, (chunk.timestamp & 0x000000FF) >> 0);
  view.setUint8(7, (chunk.timestamp & 0xFF000000) >> 24);
  // streamId
  view.setUint8(8, 0);
  view.setUint8(9, 0);
  view.setUint8(10, 0);
  // content
  for (let i = 0; i < message.byteLength; i++) {
    view.setUint8(i + 11, message[i]);
  }
  // prevTagSize
  view.setUint32(11 + message.byteLength, 0, false)
  //
  return buffer;
}