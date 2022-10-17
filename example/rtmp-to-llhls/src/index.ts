import net from 'net';
import express from 'express';
import cors from 'cors';
import { Command } from 'commander';

import { PassThrough } from 'stream';

import { EventEmitter, EventTypes, RtmpReader } from '@monyone/mikan';
import M3U8 from '@monyone/ts-fragmenter'
import FlvToMp2tTransform from './transform';

const src = new PassThrough()
const flvToMp2t = new FlvToMp2tTransform();

const program = new Command();
program
  .option('-p, --port <number>', 'specify LL-HLS serving port')
  .option('-r, --rtmp <number>', 'specify RTMP listening port')
  .option('-s, --slient', 'enable slient mode')

program.parse(process.argv);
const options = program.opts();

const port = options.port ?? 8080;
const rtmp = options.rtmp ?? 1935;

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

  emitter.on(EventTypes.FLV_CHUNK_OUTPUT, ({ chunk }) => {
    src.write(new Uint8Array(chunk))
  });
  
  connection.on('close', () => {
    reader.abort();
  });
});
server.listen(rtmp);
if (!options.slient) {
  console.log(`Start on RTMP port ${rtmp}.`)
}

// LL-HLS
const m3u8 = new M3U8({ 
  length: 4,
  partTarget: 0.3,
});
src.pipe(flvToMp2t).pipe(m3u8);

const app = express()
app.use(cors());
app.listen(port, () => {
  if (!options.slient) {
    console.log(`Start on LL-HLS port ${port}.`)
  }
});
app.get('/manifest.m3u8', (req: express.Request, res: express.Response) => {
  const { _HLS_msn, _HLS_part } = req.query;

  if (_HLS_msn && _HLS_part) {
    const msn = Number.parseInt(_HLS_msn as string);
    const part = Number.parseInt(_HLS_part as string);

    if (m3u8.isFulfilledPartial(msn, part)) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl')
      res.send(m3u8.getManifest());
    } else {
      m3u8.addPartialCallback(msn, part, () => {
        res.set('Content-Type', 'application/vnd.apple.mpegurl')
        res.send(m3u8.getManifest());
      })
    }
  } else if (_HLS_msn) {
    const msn = Number.parseInt(_HLS_msn as string);
    const part = 0;

    if (m3u8.isFulfilledPartial(msn, part)) {
      res.set('Content-Type', 'application/vnd.apple.mpegurl')
      res.send(m3u8.getManifest());
    } else {
      m3u8.addPartialCallback(msn, part, () => {
        res.set('Content-Type', 'application/vnd.apple.mpegurl')
        res.send(m3u8.getManifest());
      })
    }
  } else {
    res.set('Content-Type', 'application/vnd.apple.mpegurl')
    res.send(m3u8.getManifest());
  }
})
app.get('/segment', (req: express.Request, res: express.Response) => {
  const { msn } = req.query;
  const _msn = Number.parseInt(msn as string)

  if (!m3u8.inRangeSegment(_msn)) {
    res.status(404).end();
    return;
  }

  if (m3u8.isFulfilledSegment(_msn)) {
    res.set('Content-Type', 'video/mp2t');
    res.send(m3u8.getSegment(_msn));
  } else {
    m3u8.addSegmentCallback(_msn, () => {
      res.set('Content-Type', 'video/mp2t');
      res.send(m3u8.getSegment(_msn));
    });
  }
})
app.get('/part', (req: express.Request, res: express.Response) => {
  const { msn, part } = req.query;

  const _msn = Number.parseInt(msn as string);
  const _part = Number.parseInt(part as string);

  if (!m3u8.inRangePartial(_msn, _part)) {
    res.status(404).end();
    return;
  }

  if (m3u8.isFulfilledPartial(_msn, _part)) {
    res.set('Content-Type', 'video/mp2t');
    res.send(m3u8.getPartial(_msn, _part));
  } else {
    m3u8.addPartialCallback(_msn, _part, () => {
      res.set('Content-Type', 'video/mp2t');
      res.send(m3u8.getPartial(_msn, _part));
    })
  }
})
