import BitStream from "../util/bitstream"

export default (avc_decoder_configuration_record: Buffer) => {
  let begin = 0;
  const configurationVersion = avc_decoder_configuration_record.readUInt8(begin + 0);  
  const avcProfileIndication = avc_decoder_configuration_record.readUInt8(begin + 1); 
  const profileCompatibility = avc_decoder_configuration_record.readUInt8(begin + 2);  
  const avcLevelIndication = avc_decoder_configuration_record.readUInt8(begin + 3);
  const naluLengthSize = (avc_decoder_configuration_record.readUInt8(begin + 4) & 3) + 1;
  begin += 5;

  const spsCount = avc_decoder_configuration_record.readUInt8(begin + 0) & 0x1F;
  begin += 1;
  let sps: Buffer | null = null;
  for (let i = 0; i < spsCount; i++) {
    const length = avc_decoder_configuration_record.readUInt16BE(begin + 0);
    if (sps == null) { sps = avc_decoder_configuration_record.slice(begin + 2, begin + 2 + length); }
    begin += 2 + length;
  }
  const ppsCount = avc_decoder_configuration_record.readUInt8(begin + 0);
  begin += 1;
  let pps: Buffer | null = null;
  for (let i = 0; i < ppsCount; i++) {
    const length = avc_decoder_configuration_record.readUInt16BE(begin + 0);
    if (pps == null) { pps = avc_decoder_configuration_record.slice(begin + 2, begin + 2 + length); }
    begin += 2 + length;
  }

  if (sps == null || pps == null) { 
    return null;
  }

  return {
    configurationVersion,
    avcProfileIndication,
    profileCompatibility,
    avcLevelIndication,
    naluLengthSize,
    sps,
    pps
  };
}