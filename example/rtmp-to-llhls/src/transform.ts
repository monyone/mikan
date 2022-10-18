import { Transform, TransformCallback } from "stream";
import generateADTS from "./aac/adts";
import parseAACConfig from "./aac/config";
import parseH264Config from "./h264/config";
import parseAAC from "./flv/aac";
import parseH264 from "./flv/h264";
import parseAudio, { AUDIO_TYPE_AAC } from "./flv/audio";
import parseVideo, { VIDEO_TYPE_H264 } from "./flv/video";
import parseChunk, { STREAM_TYPE_AUDIO, STREAM_TYPE_VIDEO } from "./flv/chunk";
import FLVQueue from "./flv/queue";
import { packtizeSection, packtizePES, packtizePCR } from "./ts/packtize";
import { buildPAT, buildPMT } from "./ts/section";

export default class FlvToMp2tTransform extends Transform {
  #queue = new FLVQueue();
  #audioSpecificConfig: ReturnType<typeof parseAACConfig> = null;
  #AVCDecoderConfigurationRecord: ReturnType<typeof parseH264Config> = null;
  #lastPSIEmitTimestamp: number | null = null;

  readonly #pmtPid: number = 0x100;
  readonly #pcrPid: number = 0x101;
  readonly #h264Pid: number = 0x102;
  readonly #aacPid: number = 0x103;

  readonly #PAT: Buffer = buildPAT([[1, this.#pmtPid]]);
  readonly #PMT: Buffer = buildPMT(1, 0x101, [
    [0x1b, this.#h264Pid, Buffer.from([])],
    [0x0F, this.#aacPid, Buffer.from([])]
  ]);

  #patCounter: number = 0;
  #pmtCounter: number = 0;
  #pcrCounter: number = 0;
  #aacCounter: number = 0;
  #h264Counter: number = 0;

  _transform (chunk: Buffer, encoding: string, callback: TransformCallback): void {
    this.#queue.push(chunk);

    while (!this.#queue.isEmpty()) {
      const { timestamp, streamTypeId, payload } = parseChunk(this.#queue.pop()!);

      if (streamTypeId === STREAM_TYPE_VIDEO) {
        const { codecId, videoData } = parseVideo(payload);

        if (codecId !== VIDEO_TYPE_H264) { continue; }

        const { avcPacketType, compositionTime, data} = parseH264(videoData);
        if (avcPacketType === 0) {
          this.#AVCDecoderConfigurationRecord = parseH264Config(data);
        } else if (this.#AVCDecoderConfigurationRecord) {
          const dts = (timestamp * 90) % (2 ** 33);
          const pts = ((timestamp + compositionTime) * 90) % (2 ** 33);

          const nalus: Buffer[] = [];
          let begin = 0;
          let hasSPS = false, hasPPS = false;
          let hasAUD = false; // AVPlayer Needs AUD
          while (begin < data.byteLength) {
            let length = 0;
            for (let i = 0; i < this.#AVCDecoderConfigurationRecord.naluLengthSize; i++) {
              length *= 256;
              length += data[begin + i];
            }
            begin += this.#AVCDecoderConfigurationRecord.naluLengthSize;

            const nal_unit_type = data[begin + 0] & 0x1F;
             
            if (nal_unit_type === 9) {
              hasAUD = true;
            } else if (!hasAUD) {
              nalus.push(Buffer.from([0, 0, 0, 1, 0x09, 0xF0]));
              hasAUD = true;
            }

            if (nal_unit_type === 7) {
              hasSPS = true;
            } else if(nal_unit_type === 8) {
              hasPPS = true;
            }

            if (nal_unit_type === 5) {
              if (!hasSPS) {
                nalus.push(Buffer.from([0, 0, 1]));
                nalus.push(this.#AVCDecoderConfigurationRecord.sps);
              }
              if (!hasPPS) {
                nalus.push(Buffer.from([0, 0, 1]));
                nalus.push(this.#AVCDecoderConfigurationRecord.pps);
              }
              nalus.push(Buffer.from([0, 0, 1]));
              nalus.push(data.slice(begin, begin + length));
            } else {
              nalus.push(Buffer.from([0, 0, 1]));
              nalus.push(data.slice(begin, begin + length));
            }
            begin += length;
          }

          for (const packet of packtizePES(Buffer.concat(nalus), false, false, this.#h264Pid, 0, this.#h264Counter, true, 0xe0, pts, dts)) {
            this.push(packet);
            this.#h264Counter = (this.#h264Counter + 1) & 0x0F;
          }
        }
      } else if (streamTypeId === STREAM_TYPE_AUDIO) {
        const { soundFormat, audioData } = parseAudio(payload);

        if (soundFormat !== AUDIO_TYPE_AAC) { continue; }

        const { aacPacketType, data } = parseAAC(audioData);
        if (aacPacketType === 0) {
          this.#audioSpecificConfig = parseAACConfig(data);
        } else if (this.#audioSpecificConfig) {
          for (const packet of packtizePES(generateADTS(this.#audioSpecificConfig, data)!, false, false, this.#aacPid, 0, this.#aacCounter, false, 0xc0, (timestamp * 90) % (2 ** 33))) {
            this.push(packet);
            this.#aacCounter = (this.#aacCounter + 1) & 0x0F;
          }
        }
      }

      if (this.#lastPSIEmitTimestamp == null || (timestamp - this.#lastPSIEmitTimestamp) >= 100) {
        // send PAT
        for (const packet of packtizeSection(this.#PAT, false, false, 0, 0, this.#patCounter)) {
          this.push(packet);
          this.#patCounter = (this.#patCounter + 1) & 0x0F;
        }
        // send PMT
        for (const packet of packtizeSection(this.#PMT, false, false, this.#pmtPid, 0, this.#pmtCounter)) {
          this.push(packet);
          this.#pmtCounter = (this.#pmtCounter + 1) & 0x0F;
        }
        // send PCR
        {
          const packet = packtizePCR(false, false, this.#pcrPid, 0, this.#pcrCounter, (timestamp * 90) % (2 ** 33));
          this.push(packet);
          this.#pcrCounter = (this.#pcrCounter + 1) & 0x0F;
        }
        // update timestamp
        this.#lastPSIEmitTimestamp = timestamp;
      }
    }

    callback();
  }

  _flush (callback: TransformCallback): void {
    callback();
  }
}
