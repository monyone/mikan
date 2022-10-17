
export default (audioData: Buffer) => {
  const aacPacketType = audioData.readUInt8(0);
  
  return {
    aacPacketType,
    data: audioData.slice(1)
  }
}