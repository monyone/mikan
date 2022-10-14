import EventEmitter from "../event/eventemitter";
import { Events, EventTypes } from "../event/events";
import { parseTWO, buildTWO, bulidRandom, parseZERO, buildZERO, parseONE, buildONE } from "../lib/initial";
import parseAMF from "../amf0/parser"
import ChunkReciever from "../chunk/reciever";
import concat from "../util/binary";

enum HandshakeState {
  INITIAL,
  WAITING_ZERO,
  WAITING_ONE,
  WAITING_TWO,
  ESTABLISHED
}

type ReaderOption = {
  dumpFLV: boolean
};

export default class Sender {
  #emitter: EventEmitter;

  #handshakeState: HandshakeState = HandshakeState.INITIAL;
  #time: number = 0;
  #ownRandom: ArrayBuffer = bulidRandom(1528);
  #recieverRandom: ArrayBuffer | null = null;

  #chunkReciever = new ChunkReciever();
  #chunkSize: number = 128;

  readonly #onRtmpChunkRecievedHandler = this.#onRtmpChunkRecieved.bind(this);

  public constructor(emitter: EventEmitter) {
    this.#emitter = emitter;
  }

  public start() {
    this.abort();

    this.#emitter.on(EventTypes.RTMP_CHUNK_RECIEVED , this.#onRtmpChunkRecievedHandler);

    this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
      event: EventTypes.RTMP_CHUNK_SEND,
      chunk: buildZERO({
        version: 3
      })
    });
    this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
      event: EventTypes.RTMP_CHUNK_SEND,
      chunk: buildONE({
        time: this.#time,
        random: this.#ownRandom
      })
    });
    this.#handshakeState = HandshakeState.WAITING_ZERO;
  }

  public abort() {
    this.#emitter.off(EventTypes.RTMP_CHUNK_RECIEVED , this.#onRtmpChunkRecievedHandler);
  }

  #onRtmpChunkRecieved({ chunk }: Events[typeof EventTypes.RTMP_CHUNK_RECIEVED]) {
    let begin = 0;
    switch (this.#handshakeState) {
      case HandshakeState.INITIAL: { break;} 
      case HandshakeState.WAITING_ZERO: {
        if (chunk.byteLength < begin + 1) { break; }
        parseZERO(chunk.slice(begin, begin + 1));
        begin += 1;

        chunk = chunk.slice(begin);
        this.#handshakeState = HandshakeState.WAITING_ONE;
      }
      case HandshakeState.WAITING_ONE: {
        if (chunk.byteLength < begin + 1536) { break; }
        const ONE = parseONE(chunk.slice(begin, begin + 1536));
        begin += 1536;
        this.#recieverRandom = ONE.random;

        chunk = chunk.slice(begin);
        this.#handshakeState = HandshakeState.WAITING_TWO;
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

        this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
          event: EventTypes.RTMP_CHUNK_SEND,
          chunk: buildTWO({
            time: TWO.time,
            time2: this.#time,
            random: this.#recieverRandom!
          })
        });

        this.#handshakeState = HandshakeState.ESTABLISHED;
        chunk = chunk.slice(begin);
      }
      case HandshakeState.ESTABLISHED: {
        // TODO: NEEDS IMPLEMENTS

        for (const info of this.#chunkReciever.recieveChunk(chunk, this.#chunkSize)) {
          const message = concat(... info.message);

          if (info.message_type_id === 20) { // AMF0
            const amf = parseAMF(message);
            
            if (!Array.isArray(amf)) { continue; }
            const [name, transaction_id, ... objs] = amf;

            switch(name) {
              default: break; 
            }
          }
        }
        break;
      }
    }
  }
};