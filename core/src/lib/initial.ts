export type ZERO = {
	version: number
};

export type ONE = {
  time: number,
  random: ArrayBuffer
};

export type TWO = {
  time: number,
  time2: number,
  random: ArrayBuffer,
}

export const parseZERO = (data: ArrayBuffer): ZERO => {
	const view = new DataView(data);
	return {
		version: view.getInt8(0)
	};
}
export const buildZERO = (zero: ZERO): ArrayBuffer => {
  const buffer = new ArrayBuffer(1);
  const data = new Uint8Array(buffer);
  data[0] = zero.version;
  return buffer;
}

export const parseONE = (data: ArrayBuffer): ONE => {
  const view = new DataView(data);
  return {
    time: view.getUint32(0, false),
    random: data.slice(8)
  };
}
export const buildONE = (one: ONE): ArrayBuffer => {
  const buffer = new ArrayBuffer(8 + one.random.byteLength);

  const randomView = new DataView(one.random);
  const bufferView = new DataView(buffer);
  bufferView.setUint32(0, one.time, false);
  bufferView.setUint32(4, 0, false);
  for (let i = 0; i < randomView.byteLength; i++) {
    bufferView.setUint8(8 + i, randomView.getUint8(i));
  }

  return buffer;
}

export const parseTWO = (data: ArrayBuffer): TWO => {
  const view = new DataView(data);
  return {
    time: view.getUint32(0, false),
    time2: view.getUint32(4, false),
    random: data.slice(8)
  };
};
export const buildTWO = (two: TWO): ArrayBuffer => {
  const buffer = new ArrayBuffer(8 + two.random.byteLength);

  const randomView = new DataView(two.random);
  const bufferView = new DataView(buffer);
  bufferView.setUint32(0, two.time, false);
  bufferView.setUint32(4, two.time2, false);
  for (let i = 0; i < randomView.byteLength; i++) {
    bufferView.setUint8(8 + i, randomView.getUint8(i));
  }

  return buffer;
}

export const bulidRandom = (bytes: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  for (let i = 0; i < bytes; i++) {
    view.setInt8(i, Math.floor(Math.random() * 256));
  }
  return buffer;
};