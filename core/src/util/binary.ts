export default (... data: ArrayBuffer[]): ArrayBuffer => {
  const bytes = data.reduce((prev, curr) => prev + curr.byteLength, 0);
  const uint8 = new Uint8Array(bytes);

  for (let i = 0, offset = 0; i < data.length; offset += data[i++].byteLength) {
    uint8.set(new Uint8Array(data[i]), offset);
  }

  return uint8.buffer;
}