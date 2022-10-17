import AudioSpecificConfig from './config'

const samplingFrequencyIndexMap = new Map<number, number>([
  [96000, 0x00],
  [88200, 0x01],
  [64000, 0x02],
  [48000, 0x03],
  [44100, 0x04],
  [32000, 0x05],
  [24000, 0x06],
  [22050, 0x07],
  [16000, 0x08],
  [12000, 0x09],
  [11025, 0x0A],
  [8000, 0x0B],
  [7350, 0x0C],
]);

export default (config: Exclude<ReturnType<typeof AudioSpecificConfig>, null>, data: Buffer) => {
  if (config == null) { return null; }

  const samplingFrequencyIndex = samplingFrequencyIndexMap.get(config.samplingFrequency)!;
  const channelConfiguration = config.channelConfiguration;
  const frameLength = 7 + data.byteLength;
  const bufferFullness = 0x7FF;

  return Buffer.concat([
    Buffer.from([
      0xFF, 0xF1, // syncword (12bit) mpeg_version (1bit), layer (2bit), protection (1bit, protected is 0)
      (1 << 6) | ((samplingFrequencyIndex & 0x0F) << 2) | (0 << 1) | ((channelConfiguration & 0x04) >> 2), // profile(2bit, LC=1), frequency_index (4bit), private_bit (1bit), channel_configuration (1bit of 3bit)
      ((channelConfiguration & 0x03) << 6) | (0 << 5) | (0 << 4) | (0 << 3) | (0 << 2) | ((frameLength & 0x1800) >> 11),
      ((frameLength & 0x7F8) >> 3),
      ((frameLength & 0x7) << 5) | ((bufferFullness & 0x7C0) >> 6),
      ((bufferFullness & 0x3F) << 2) | (0 >> 0),
    ]),
    data
  ]);
}