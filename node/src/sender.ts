import net from 'net';
import { Command } from 'commander';

import { EventEmitter, EventTypes, RtmpSender } from '@monyone/mikan';

const program = new Command();
program
  .option('-t, --to <url>', 'specify relay url')
program.parse(process.argv);
const options = program.opts();
if (options.to == null) {
  console.error('please specify destination');
  process.exit(-1);
}
const destination = new URL(options.to);
const port = Number.isNaN(Number.parseInt(destination.port)) ? 1935 : Number.parseInt(destination.port);

const client = net.connect(port, destination.hostname, () => {
  sender.start();
});
const emitter = new EventEmitter();
const sender = new RtmpSender(emitter);
  
client.on("data", (data) => {
  emitter.emit(EventTypes.RTMP_CHUNK_RECIEVED, {
    event: EventTypes.RTMP_CHUNK_RECIEVED,
    chunk: data.buffer
  });
});

emitter.on(EventTypes.RTMP_CHUNK_SEND, ({ chunk }) => {
  client.write(new Uint8Array(chunk));
});
  
client.on('close', () => {
  sender.abort();
});

