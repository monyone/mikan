import EventEmitter from "../event/eventemitter";
import { Events, EventTypes } from "../event/events";
import { parseTWO, buildTWO, bulidRandom, parseZERO, buildZERO, parseONE, buildONE } from "../lib/initial";
import AMF from "../amf"

enum HandshakeState {
  WAITING_ZERO,
  WAITING_ONE,
  WAITING_TWO,
  ESTABLISHED
}

export default class Reader {
  #emitter: EventEmitter;
  #handshakeState: HandshakeState = HandshakeState.WAITING_ZERO;
  #time: number = 0;
  #ownRandom: ArrayBuffer = bulidRandom(1528);
  #senderRandom: ArrayBuffer | null = null;

  readonly #onRtmpChunkRecievedHandler = this.#onRtmpChunkRecieved.bind(this);

  public constructor(emitter: EventEmitter) {
    this.#emitter = emitter;
  }

  public start() {
    this.abort();

    this.#emitter.on(EventTypes.RTMP_CHUNK_RECIEVED , this.#onRtmpChunkRecievedHandler);
  }

  public abort() {
    this.#emitter.off(EventTypes.RTMP_CHUNK_RECIEVED , this.#onRtmpChunkRecievedHandler);
  }

  #onRtmpChunkRecieved({ chunk }: Events[typeof EventTypes.RTMP_CHUNK_RECIEVED]) {
    let begin = 0;
    switch (this.#handshakeState) {
      case HandshakeState.WAITING_ZERO: {
        if (chunk.byteLength < begin + 1) { break; }
        parseZERO(chunk.slice(begin, begin + 1));
        begin += 1;

        this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
          event: EventTypes.RTMP_CHUNK_SEND,
          chunk: buildZERO({
            version: 3
          })
        });

        this.#handshakeState = HandshakeState.WAITING_ONE;
      }
      case HandshakeState.WAITING_ONE: {
        if (chunk.byteLength < begin + 1536) { break; }
        const ONE = parseONE(chunk.slice(begin, begin + 1536));
        begin += 1536;

        this.#senderRandom = ONE.random;

        this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
          event: EventTypes.RTMP_CHUNK_SEND,
          chunk: buildONE({
            time: this.#time,
            random: this.#ownRandom
          })
        });

        this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
          event: EventTypes.RTMP_CHUNK_SEND,
          chunk: buildTWO({
            time: ONE.time,
            time2: this.#time,
            random: ONE.random
          })
        });

        this.#handshakeState = HandshakeState.WAITING_TWO;
        break;
      }
      case HandshakeState.WAITING_TWO: {
        if (chunk.byteLength < begin + 1536) { break; }
        const TWO = parseTWO(chunk.slice(begin, begin + 1536));
        begin += 1536;

        const oneView = new DataView(this.#ownRandom!);
        const twoView = new DataView(TWO.random);
        
        let same = true;
        if (oneView.byteLength !== twoView.byteLength) { same = false; }
        if (same) {
          for (let i = 0; i < oneView.byteLength; i++) {
            if (oneView.getUint8(i) !== twoView.getUint8(i)) {
              same = false;
              break;
            }
          }
        }
        if (!same) { break; }

        this.#handshakeState = HandshakeState.ESTABLISHED;
      }
      case HandshakeState.ESTABLISHED: {
        const view = new DataView(chunk);
        while (begin < chunk.byteLength) {
          const fmt = view.getUint8(begin + 0) & 0xC00;
          const chunk_stream_id = view.getUint8(begin + 0) & 0x3F;

          if (fmt === 0) {
            let timestamp = (view.getUint8(begin + 1) << 16) || (view.getUint8(begin + 2) << 8) || (view.getUint8(begin + 3) << 0);
            const message_length = (view.getUint8(begin + 4) << 16) || (view.getUint8(begin + 5) << 8) || (view.getUint8(begin + 6) << 0);
            const message_type_id = view.getUint8(begin + 7);
            const message_stream_id = view.getUint32(begin + 8);

            if (timestamp >= 0xFFFFFF) {
              timestamp = view.getUint32(begin + 12);

              if (message_type_id === 20) {
                console.log(AMF(chunk.slice(begin + 16)));
              }
              begin = Math.min(begin + 16 + message_length, chunk.byteLength);
            } else {
              if (message_type_id === 20) {
                console.log(AMF(chunk.slice(begin + 12)));
              }
              begin = Math.min(begin + 12 + message_length, chunk.byteLength);
            }



            begin = chunk.byteLength;
          } else if (fmt === 1) {
            let timestamp_delta = (view.getUint8(begin + 1) << 16) || (view.getUint8(begin + 2) << 8) || (view.getUint8(begin + 3) << 0);
            const message_length = (view.getUint8(begin + 4) << 16) || (view.getUint8(begin + 5) << 8) || (view.getUint8(begin + 6) << 0);
            const message_type_id = view.getUint8(begin + 7);

            if (timestamp_delta >= 0xFFFFFF) {
              timestamp_delta = view.getUint32(begin + 8);
              begin = Math.min(begin + 12 + message_length, chunk.byteLength);
            } else {
              begin = Math.min(begin + 8 + message_length, chunk.byteLength);
            }

            begin = chunk.byteLength;
          } else if (fmt === 2) {
            let timestamp_delta = (view.getUint8(begin + 1) << 16) || (view.getUint8(begin + 2) << 8) || (view.getUint8(begin + 3) << 0);
            if (timestamp_delta >= 0xFFFFFF) {
              timestamp_delta = view.getUint32(begin + 4);
            }
            begin = chunk.byteLength;
          } else if (fmt === 3) {
            begin = chunk.byteLength;
          }
        }

        break;
      }
    }
  }
};