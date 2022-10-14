import net from 'net';
import { Command } from 'commander';

import { EventEmitter, EventTypes, RtmpReader } from '@monyone/mikan';

const program = new Command();
program
  .option('-p, --port <number>', 'specify serving port')
program.parse(process.argv);
const options = program.opts();
const port = options.port ?? 6789;

const server = net.createServer((connection) => {
  const emitter = new EventEmitter();
  const reader = new RtmpReader(emitter);
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

  /*
  emitter.on(EventTypes.FLV_CHUNK_OUTPUT, ({ chunk }) => {
    process.stdout.write(new Uint8Array(chunk));
  });
  */
  
  connection.on('close', () => {
    reader.abort();
  });
});

server.listen(port);

