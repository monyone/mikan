export default (data: Buffer) => {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    for (let index = 7; index >= 0; index--) {
      const bit = (byte & (1 << index)) >> index;
      const c = (crc & 0x80000000) != 0 ? 1 : 0;
      crc <<= 1;
      if (c ^ bit) { crc ^= 0x04c11db7; }
      crc &= 0xFFFFFFFF;
    }
  }
  return crc;
}
