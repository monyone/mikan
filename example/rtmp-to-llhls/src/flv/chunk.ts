export const STREAM_TYPE_AUDIO = 8;
export const STREAM_TYPE_VIDEO = 9;
//export const STREAM_TYPE_SCRIPT = 11;

export default (chunk: Buffer) => {
  const prevTagSize = chunk.readUInt32BE(0);
  const streamTypeId = chunk.readUInt8(4);
  const length = (chunk.readUInt8(5) << 16) | (chunk.readUInt8(6) << 8) | (chunk.readUInt8(7) << 0);
  const timestamp = (chunk.readUInt8(11) << 24) | (chunk.readUInt8(8) << 16) | (chunk.readUInt8(9) << 8) | (chunk.readUInt8(10) << 0);
  const streamId = (chunk.readUInt8(12) << 16) | (chunk.readUInt8(13) << 8) | (chunk.readUInt8(14) << 0);
  const payload = chunk.slice(15);

  return {
    prevTagSize,
    streamTypeId,
    length,
    timestamp,
    streamId,
    payload
  };
}