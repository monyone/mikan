import concat from "../util/binary";
import { Chunk } from "./parse";

const MESSAGE_SIZE = 128 - 16;

export default (chunk: Omit<Chunk, 'message_length'>): ArrayBuffer[] => {
  const message = concat(chunk.message);
  const send = [];

  const chunk_stream_id = chunk.chunk_stream_id;
  const timestamp = chunk.timestamp;
  const message_length = message.byteLength;
  const message_type_id = chunk.message_type_id;
  const message_stream_id = chunk.message_stream_id;

  for (let offset = 0; offset < message.byteLength; offset += MESSAGE_SIZE) {
    if (offset === 0) {
      const buffer = new ArrayBuffer(12);
      const view = new DataView(buffer);

      view.setUint8(0, (0x00 << 6) | chunk_stream_id);
      view.setUint8(1, (timestamp & 0x00FF0000) >> 16);
      view.setUint8(2, (timestamp & 0x0000FF00) >> 8);
      view.setUint8(3, (timestamp & 0x000000FF) >> 0);
      view.setUint8(4, (message_length & 0x00FF0000) >> 16);
      view.setUint8(5, (message_length & 0x0000FF00) >> 8);
      view.setUint8(6, (message_length & 0x000000FF) >> 0);
      view.setUint8(7, (message_type_id));
      view.setUint32(8, message_stream_id);

      send.push(Uint8Array.from([
        ... (new Uint8Array(buffer)),
        ... (new Uint8Array(message.slice(offset, offset + MESSAGE_SIZE))),
      ]).buffer);
    } else {
      send.push(Uint8Array.from([
        (0x03 << 6) | chunk_stream_id,
        ... (new Uint8Array(message.slice(offset, offset + MESSAGE_SIZE))),
      ]).buffer);
    }
  }

  return send;
}