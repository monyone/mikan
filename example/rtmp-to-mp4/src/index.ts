import net from 'net';
import { Command } from 'commander';

import { EventEmitter, EventTypes, RtmpReader } from '@monyone/mikan';

import FLVQueue from './flv/queue';
import parseAAC from "./flv/aac";
import parseH264 from "./flv/h264";
import parseAudio, { AUDIO_TYPE_AAC } from "./flv/audio";
import parseVideo, { VIDEO_TYPE_H264 } from "./flv/video";
import parseChunk, { STREAM_TYPE_AUDIO, STREAM_TYPE_VIDEO } from "./flv/chunk";
import { ftyp, moov, moof, mdat } from './mp4/box';

const program = new Command();
program
  .option('-r, --rtmp <number>', 'specify RTMP listening port')
  .option('-s, --slient', 'enable slient mode')

program.parse(process.argv);
const options = program.opts();

const rtmp = options.rtmp ?? 1935;

const queue = new FLVQueue();
let seq = 0;
let avcC: ArrayBuffer | null = null;
let mp4a: ArrayBuffer | null = null;

// RTMP
const server = net.createServer((connection) => {
  connection.setNoDelay(true);
  const emitter = new EventEmitter();
  const reader = new RtmpReader(emitter, { dumpFLV: true });
  reader.start();
  
  connection.on("data", (data) => {
    emitter.emit(EventTypes.RTMP_CHUNK_RECIEVED, {
      event: EventTypes.RTMP_CHUNK_RECIEVED,
      chunk: data.buffer
    });
  });

  emitter.on(EventTypes.RTMP_CHUNK_SEND, ({ chunk }) => {
    connection.write(new Uint8Array(chunk));
  });

  process.stdout.write(Buffer.from(ftyp()));

  emitter.on(EventTypes.FLV_CHUNK_OUTPUT, ({ chunk }) => {
    queue.push(Buffer.from(chunk));

    while (!queue.isEmpty()) {
      const { timestamp, streamTypeId, payload } = parseChunk(queue.pop()!);

      if (streamTypeId === STREAM_TYPE_VIDEO) {
        const { codecId, videoData } = parseVideo(payload);

        if (codecId !== VIDEO_TYPE_H264) { continue; }

        const { avcPacketType, compositionTime, data} = parseH264(videoData);
        if (avcPacketType === 0) {
          avcC = data;
          process.stdout.write(Buffer.from(moov(
            { timescale: 1000 },
            [
              {
                trackId: 1,
                handler: 'vide',
                codec: 'avc1',
                config: avcC,
                timescale: 1000,
              }
            ]
          )));
        } else if (avcC != null) {
          process.stdout.write(Buffer.from(moof(seq++, [{
            trackId: 1,
            dataOffset: 0,
            sampleCount: 1,
            baseMediaDecodeTime: timestamp,
            duration: 1 / 30 * 1000,
            samples: [
              {
                duration: 1 / 30 * 1000,
                size: data.byteLength,
                flags: {
                  isLeading: false,
                  dependsOn: false,
                  isDependedOn: false,
                  hasRedundancy: false,
                  isNonSync: false,
                },
                compositionTimeOffset: compositionTime
              }
            ],
          }])));
          process.stdout.write(Buffer.from(mdat(data)));
        }
      } else if (streamTypeId === STREAM_TYPE_AUDIO) {
        const { soundFormat, audioData } = parseAudio(payload);

        if (soundFormat !== AUDIO_TYPE_AAC) { continue; }

        const { aacPacketType, data } = parseAAC(audioData);
        if (aacPacketType === 0) {
          mp4a = data;
        } else if (mp4a != null) {
         
        }
      }
    }
  });
  
  connection.on('close', () => {
    reader.abort();
  });
});
server.listen(rtmp);
if (!options.slient) {
  console.log(`Start on RTMP port ${rtmp}.`)
}
