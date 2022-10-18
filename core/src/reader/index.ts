import EventEmitter from "../event/eventemitter";
import { Events, EventTypes } from "../event/events";
import { parseTWO, buildTWO, bulidRandom, parseZERO, buildZERO, parseONE, buildONE } from "../lib/initial";
import parseAMF from "../amf0/parser"
import ChunkReciever from "../chunk/reciever";
import concat from "../util/binary";
import { generateConnectResult, generateCreateStreamResult, generateOnFCPublish, generateOnStatusPublish, generateSetChunkSize, generateSetPeerBandwidth, generateUserStreamBegin, generateWindowAcknowledgementSize } from "../command/reader";
import flv from "../chunk/flv";

enum HandshakeState {
  WAITING_ZERO,
  WAITING_ONE,
  WAITING_TWO,
  ESTABLISHED
}

enum ConnectionState {
  WAITING_CONNECT,
  WAITING_FCPUBLISH,
  WAITING_PUBLISH,
  PUBLISHED,
  TERMINATED
}

type ReaderOption = {
  dumpFLV: boolean
  app?: string,
  streamKey?: string
};

export default class Reader {
  #emitter: EventEmitter;
  #option: ReaderOption;

  #handshakeState: HandshakeState = HandshakeState.WAITING_ZERO;
  #connectionState: ConnectionState = ConnectionState.WAITING_CONNECT;
  #time: number = 0;
  #ownRandom: ArrayBuffer = bulidRandom(1528);

  #chunkReciever = new ChunkReciever();
  #chunkSize: number = 128;
  #app = '';
  #streamKey = '';

  // for FLV
  #priviousTagSize: number = 0;
  #privousDTS: number = 0;
  #flvNeedsHeader: boolean = true;
  
  readonly #onRtmpChunkRecievedHandler = this.#onRtmpChunkRecieved.bind(this);

  public constructor(emitter: EventEmitter, option?: Partial<ReaderOption>) {
    this.#emitter = emitter;
    this.#option = {
      dumpFLV: false,
      ... option
    };
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

    // if Handshaking
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
        chunk = chunk.slice(begin);
      }
      case HandshakeState.ESTABLISHED: {
        break;
      }
    }

    // if Established
    if (this.#handshakeState !== HandshakeState.ESTABLISHED) { return; }

    for (const info of this.#chunkReciever.recieveChunk(chunk, this.#chunkSize)) {
      const message = concat(... info.message);

      if (info.message_stream_id === 0) { // system message
        if (info.message_type_id === 1) {
          // for chunk size
          const view = new DataView(message);
          this.#chunkSize = view.getUint32(0, false);
        } else if (info.message_type_id === 20) { // AMF0
          const amf = parseAMF(message);
          
          if (!Array.isArray(amf)) { continue; }
          const [name, transaction_id, ... objs] = amf;

          switch(name) {
            case 'connect': {
              if (this.#connectionState !== ConnectionState.WAITING_CONNECT) { return; }

              const { app } = objs[0];
              if (this.#option.app != null && this.#option.app !== app) {
                // Not Valid App, ignore serving
                this.#connectionState = ConnectionState.WAITING_CONNECT;
                this.#handshakeState = HandshakeState.WAITING_ZERO;
                this.#emitter.emit(EventTypes.RTMP_APP_INVALID, {
                  event: EventTypes.RTMP_APP_INVALID,
                  required: this.#option.app,
                  actual: app
                });
                
                return;
              }
              this.#app = app;

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

              this.#connectionState = ConnectionState.WAITING_FCPUBLISH;
              break;
            }
            case 'releaseStream': {
              // FIXME: MULTI MESSAGE STREAMING (Message Stream Released)
              break;
            }
            case 'FCPublish': {
              if (this.#connectionState !== ConnectionState.WAITING_FCPUBLISH) { return; }

              const streamKey = objs[1];
              if (this.#option.streamKey != null && this.#option.streamKey !== streamKey) {
                // Not Valid StreamKey, ignore serving
                this.#connectionState = ConnectionState.WAITING_CONNECT;
                this.#handshakeState = HandshakeState.WAITING_ZERO;
                this.#emitter.emit(EventTypes.RTMP_STREAMKEY_INVALID, {
                  event: EventTypes.RTMP_STREAMKEY_INVALID,
                  required: this.#option.streamKey,
                  actual: streamKey
                });
                return;
              }

              this.#streamKey = streamKey;
              for (const chunk of generateOnFCPublish(this.#time, transaction_id, this.#streamKey, 1)) {
                this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
                  event: EventTypes.RTMP_CHUNK_SEND,
                  chunk
                });
              }

              this.#connectionState = ConnectionState.WAITING_PUBLISH;
              break;
            }
            case 'createStream': {
              // FIXME: MULTI MESSAGE STREAMING (Message Stream Created)

              for (const chunk of generateCreateStreamResult(this.#time, transaction_id, 1)) {
                this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
                  event: EventTypes.RTMP_CHUNK_SEND,
                  chunk
                });
              }
              break;
            }
            case 'deleteStream': {
              // FIXME: MULTI MESSAGE STREAMING (Message Stream Deleted)
              break;
            }
            case 'FCUnpublish': {
              this.#connectionState = ConnectionState.TERMINATED;
              this.#emitter.emit(EventTypes.RTMP_TERMINATED, {
                event: EventTypes.RTMP_TERMINATED,
                app: this.#app,
                streamKey: this.#streamKey,
                messageId: 1,
              });
              break;
            }
          }
        }
      } else if (this.#connectionState === ConnectionState.WAITING_PUBLISH) {
        if (info.message_type_id === 20) { // AMF0
          const amf = parseAMF(message);

          if (!Array.isArray(amf)) { continue; }
          const [name, transaction_id, ... objs] = amf;
          
          switch(name) {
            case 'publish': {
              if (this.#connectionState !== ConnectionState.WAITING_PUBLISH) { return; }

              for (const chunk of generateOnStatusPublish(this.#time, transaction_id, this.#streamKey)) {
                this.#emitter.emit(EventTypes.RTMP_CHUNK_SEND, {
                  event: EventTypes.RTMP_CHUNK_SEND,
                  chunk
                });
              }

              this.#emitter.emit(EventTypes.RTMP_PUBLISHED, {
                event: EventTypes.RTMP_PUBLISHED,
                app: this.#app,
                streamKey: this.#streamKey,
                messageId: info.message_stream_id,
              });
              
              this.#connectionState = ConnectionState.PUBLISHED;
              break;
            }
          }
        }
      } else if (this.#connectionState === ConnectionState.PUBLISHED) {
        // FIXME: MULTI MESSAGE STREAMING (Message Stream Recieving)
        if (!this.#option.dumpFLV) { return; }
        
        if (this.#flvNeedsHeader) {
          this.#emitter.emit(EventTypes.FLV_CHUNK_OUTPUT, {
            event: EventTypes.FLV_CHUNK_OUTPUT,
            chunk: Uint8Array.from([
              0x46, 0x4C, 0x56, 1, 4 | 1, 0, 0, 0, 9
            ]).buffer
          });
          this.#flvNeedsHeader = false;
        }
  
        info.timestamp = Math.max(info.timestamp, this.#privousDTS);
        const toFLV = flv(info, this.#priviousTagSize);

        toFLV.forEach((ch) => {
          this.#priviousTagSize = ch.byteLength - 4;
          this.#emitter.emit(EventTypes.FLV_CHUNK_OUTPUT, {
            event: EventTypes.FLV_CHUNK_OUTPUT,
            chunk: ch
          });
        });
        this.#privousDTS = info.timestamp + toFLV.length;
      }
    }
  }
}
