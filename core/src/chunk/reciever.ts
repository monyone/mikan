import concat from "../util/binary";
import { Chunk } from "./parse";

export default class ChunkReciever {
  #chunkInfo: Map<number, Chunk> = new Map<number, Chunk>();
  #ascendant: ArrayBuffer = new ArrayBuffer(0);

  public recieveChunk(chunk: ArrayBuffer, chunkSize: number): Chunk[] {
    chunk = concat(this.#ascendant, chunk)
    const messages: Chunk[] = [];
    
    let begin = 0;
    const view = new DataView(chunk);

    while (begin < chunk.byteLength) {
      const fmt = (view.getUint8(begin + 0) & 0xC0) >> 6;
      let chunk_stream_id = view.getUint8(begin + 0) & 0x3F;
      let chunk_header_length = 1;
      if (chunk_stream_id === 0) {
        if (chunk.byteLength < begin + chunk_header_length + 1) {
          this.#ascendant = chunk.slice(begin);
          begin = chunk.byteLength;
          break;
        }
        chunk_stream_id = (view.getUint8(begin + 1) + 64);
        chunk_header_length += 1;
      } else if (chunk_stream_id === 1) {
        if (chunk.byteLength < begin + chunk_header_length + 2) {
          this.#ascendant = chunk.slice(begin);
          begin = chunk.byteLength;
          break;
        }
        chunk_stream_id = (view.getUint8(begin + 1) + 64) + (view.getUint8(begin + 2) * 256);
        chunk_header_length += 2;
      }

      let oldInfo = this.#chunkInfo.get(chunk_stream_id);
      if (oldInfo == null && (fmt === 2 || fmt === 3)) {
        // ignore
        begin = chunk.byteLength;
        break;
      }

      let timestamp = oldInfo?.timestamp;
      let message_length = oldInfo?.message_length;
      let message_type_id = oldInfo?.message_type_id;
      let message_stream_id = oldInfo?.message_stream_id;
      
      let timestamp_ext_flag = false;
      if (fmt === 0 || fmt === 1 || fmt === 2) {
        if (chunk.byteLength < begin + chunk_header_length + 3) {
          this.#ascendant = chunk.slice(begin);
          begin = chunk.byteLength;
          break;
        }
        const ts = (view.getUint8(begin + chunk_header_length + 0) * 256 * 256) || (view.getUint8(begin + chunk_header_length + 1) * 256) || (view.getUint8(begin + chunk_header_length + 2));
        chunk_header_length += 3;

        if (ts >= 0xFFFFFF) {
          timestamp_ext_flag = true;
        } else if(fmt === 0) {
          timestamp! = ts; 
        } else if (fmt === 2 || fmt === 1) {
          timestamp! += ts;
        }
      }
      if (fmt === 0 || fmt === 1) {
        if (chunk.byteLength < begin + chunk_header_length + 4) {
          this.#ascendant = chunk.slice(begin);
          begin = chunk.byteLength;
          break;
        }
        message_length = (view.getUint8(begin + chunk_header_length + 0) * 256 * 256) + (view.getUint8(begin + chunk_header_length + 1) * 256) + (view.getUint8(begin + chunk_header_length + 2));        
        message_type_id = view.getUint8(begin + chunk_header_length + 3);
        chunk_header_length += 4;
      }
      if (fmt === 0) {
        if (chunk.byteLength < begin + chunk_header_length + 4) {
          this.#ascendant = chunk.slice(begin);
          begin = chunk.byteLength;
          break;
        }
        message_stream_id = view.getUint32(begin + chunk_header_length + 0, true); // WHY?: Little Endian in RTMP Specificaion!!
        chunk_header_length += 4;
      }
      if (timestamp_ext_flag) {
        if (chunk.byteLength < begin + chunk_header_length + 4) {
          this.#ascendant = chunk.slice(begin);
          begin = chunk.byteLength;
          break;
        }
        const ts = view.getUint32(begin + chunk_header_length + 0);
        if(fmt === 0) {
          timestamp! = ts; 
        } else if (fmt === 2 || fmt === 1) {
          timestamp! += ts;
        }
        chunk_header_length += 4;
      }

      if (chunk.byteLength <= begin + chunk_header_length) {
        this.#ascendant = chunk.slice(begin);
        begin = chunk.byteLength;
        break;
      }

      this.#ascendant = new ArrayBuffer(0);
      const newInfo: Chunk = {
        chunk_stream_id,
        timestamp: timestamp!,
        // WHY? ffmpeg overwrite exists message length?
        message_length: (oldInfo?.message ?? []).length > 0 ? oldInfo?.message_length! : message_length!,
        message_type_id: message_type_id!,
        message_stream_id: message_stream_id!,
        message: oldInfo?.message ?? []
      };
      const currrent_total = newInfo.message.reduce((prev, curr) => prev + curr.byteLength, 0);

      const remaining = Math.min(chunk.byteLength - begin, chunkSize + chunk_header_length);
      const needs = chunk_header_length + (newInfo.message_length - currrent_total);
      const next = begin + Math.min(needs, remaining);
      newInfo.message.push(chunk.slice(begin + chunk_header_length, next));

      const next_total = currrent_total + (next - (begin + chunk_header_length));

      if (next_total >= newInfo.message_length) {
        messages.push(newInfo);
        this.#chunkInfo.set(chunk_stream_id, {
          ... newInfo,
          message: []
        });
      } else {
        this.#chunkInfo.set(chunk_stream_id, newInfo);
      }

      begin = next;
    }

    return messages;
  }
}