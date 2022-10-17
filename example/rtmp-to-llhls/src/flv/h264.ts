
export default (videoData: Buffer) => {
  const avcPacketType = videoData.readUInt8(0);
  const compositionTime = (videoData.readUInt32BE(0) << 8) >> 8;
  
  return {
    avcPacketType,
    compositionTime,
    data: videoData.slice(4)
  }
}