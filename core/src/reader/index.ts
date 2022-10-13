import EventEmitter from "../event/eventemitter";
import { Events, EventTypes } from "../event/events";
import { parseTWO, buildTWO, bulidRandom, parseZERO, buildZERO, parseONE, buildONE } from "../lib/initial";
import parseAMF from "../amf0/parser"
import ChunkReciever from "../chunk/reciever";
import concat from "../util/binary";
import { generateConnectResult, generateSetChunkSize, generateSetPeerBandwidth, generateUserStreamBegin, generateWindowAcknowledgementSize } from "../lib/command";

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

  #chunkReciever = new ChunkReciever();

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
        const filtered = (new Uint8Array(chunk.slice(begin))).filter((e) => e !== 0xC3).buffer
        for (const info of this.#chunkReciever.readChunk(filtered)) {
          const message = concat(info.message);

          if (info.message_type_id === 20) { // AMF0
            const amf = parseAMF(message);
            
            if (!Array.isArray(amf)) { continue; }
            const [name, transaction_id, ... objs] = amf;

            switch(name) {
              case 'connect': {
                // ack
                for (const chunk of generateWindowAcknowledgementSize(this.#time, 2500000)) {
                  this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
                    event: EventTypes.RTMP_CHUNK_SEND,
                    chunk
                  });
                }

                // peer
                for (const chunk of generateSetPeerBandwidth(this.#time, 2500000, 2)) {
                  this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
                    event: EventTypes.RTMP_CHUNK_SEND,
                    chunk
                  });
                }

                // user stream
                for (const chunk of generateUserStreamBegin(this.#time, 0)) {
                  this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
                    event: EventTypes.RTMP_CHUNK_SEND,
                    chunk
                  });
                }

                // chunk size
                for (const chunk of generateSetChunkSize(this.#time, 4500)) {
                  this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
                    event: EventTypes.RTMP_CHUNK_SEND,
                    chunk
                  });
                }
                
                // result
                for (const chunk of generateConnectResult(this.#time, transaction_id)) {
                  this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
                    event: EventTypes.RTMP_CHUNK_SEND,
                    chunk
                  });
                }

                break;
              }
            }
          }
        }
        break;
      }
    }
  }
};