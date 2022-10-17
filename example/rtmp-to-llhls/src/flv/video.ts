
export const VIDEO_TYPE_H264 = 7;

export default (payload: Buffer) => {
  const frameType = (payload.readUInt8(0) & 0xF0) >> 4;
  const codecId = (payload.readUInt8(0) & 0x0F);
  const videoData = payload.slice(1);

  return {
    frameType,
    codecId,
    videoData
  };
}