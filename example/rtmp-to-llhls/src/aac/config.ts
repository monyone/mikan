import BitStream from "../util/bitstream"

const samplingFrequencyIndexMap = new Map<number, number>([
  [0x00, 96000],
  [0x01, 88200],
  [0x02, 64000],
  [0x03, 48000],
  [0x04, 44100],
  [0x05, 32000],
  [0x06, 24000],
  [0x07, 22050],
  [0x08, 16000],
  [0x09, 12000],
  [0x0a, 11025],
  [0x0b, 8000],
  [0x0c, 7350],
]);

export default (audio_specific_config: Buffer) => {
  const stream = new BitStream(audio_specific_config);

  try {
    let objectType = stream.readBits(5);
    if (objectType === 31) { objectType = 32 + stream.readBits(6); }

    const samplingFrequencyIndex = stream.readBits(4);
    if (samplingFrequencyIndex === 0x0F) {
      const samplingFrequency = stream.readBits(24);
      const channelConfiguration = stream.readBits(4);

      return {
        objectType,
        samplingFrequency,
        channelConfiguration
      };
    } else {
      const channelConfiguration = stream.readBits(4);

      return {
        objectType,
        samplingFrequency: samplingFrequencyIndexMap.get(samplingFrequencyIndex)!,
        channelConfiguration
      };
    }
  } catch (e) {
    return null;
  }
}