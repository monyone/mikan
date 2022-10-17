
export const AUDIO_TYPE_AAC = 10;

export default (payload: Buffer) => {
  const soundFormat = (payload.readUInt8(0) & 0xF0) >> 4;
  const soundRate = (payload.readUInt8(0) & 0x0C) >> 2;
  const soundSize = (payload.readUInt8(0) & 0x02) >> 1;
  const soundType = (payload.readUInt8(0) & 0x01) >> 0;
  const audioData = payload.slice(1);

  return {
    soundFormat,
    soundRate,
    soundSize,
    soundType,
    audioData
  };  
}