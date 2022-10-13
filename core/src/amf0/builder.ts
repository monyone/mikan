const UTF8Encoder = new TextEncoder();

const buildNumber = (num: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  view.setFloat64(0, num);
  return buffer;
}

const buildString = (str: string): ArrayBuffer => {
  const utf8 = UTF8Encoder.encode(str);
  const buffer = new ArrayBuffer(utf8.byteLength + 2);
  const uint8 = new Uint8Array(buffer);
  const view = new DataView(buffer);

  view.setUint16(0, utf8.byteLength);
  uint8.set(utf8, 2);
  return buffer;
}

const buildLongString = (str: string): ArrayBuffer => {
  const utf8 = UTF8Encoder.encode(str);
  const buffer = new ArrayBuffer(utf8.byteLength + 4);
  const uint8 = new Uint8Array(buffer);
  const view = new DataView(buffer);

  view.setUint32(0, utf8.byteLength);
  uint8.set(utf8, 4);
  return buffer;
}

const buildObject = (obj: Record<string, any>): ArrayBuffer => {
  const result = [];

  for (const name of Object.keys(obj)) {
    const value = obj[name];

    result.push(buildString(name))
    result.push(buildValue(value));
  }
  result.push(Uint8Array.from([0, 0, 9]));

  let bytes = 0;
  result.forEach((r) => { bytes += r.byteLength; })

  const buffer = new ArrayBuffer(bytes);
  const uint8 = new Uint8Array(buffer);

  for (let i = 0, offset = 0; i < result.length; offset += result[i++].byteLength) {
    uint8.set(new Uint8Array(result[i]), offset);
  }
  return buffer;
}

const buildArray = (data: any[]) => {
  const result = data.map((d) => buildValue(d));

  let bytes = 0;
  result.forEach((r) => { bytes += r.byteLength; })

  const buffer = new ArrayBuffer(4 + bytes);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  view.setUint32(0, bytes);
  for (let i = 0, offset = 4; i < result.length; offset += result[i++].byteLength) {
    uint8.set(new Uint8Array(result[i]), offset);
  }
  return buffer;
}

const buildDate = (data: Date) => {
  const buffer = new ArrayBuffer(10);
  const view = new DataView(buffer);

  view.setFloat64(0, data.getTime());
  view.setUint16(8, 0);

  return buffer;
}

const buildValue = (data: any): ArrayBuffer => {
  if (data instanceof Date) {
    return Uint8Array.from([
      0,
      ... new Uint8Array(buildDate(data))
    ]).buffer;  
  } else if (data === null) {
    return Uint8Array.from([
      5
    ]).buffer;
  } else if (data === undefined) {
    return Uint8Array.from([
      6
    ]).buffer;
  }

  switch (typeof data) {
    case 'number': {
      return Uint8Array.from([
        0,
        ... new Uint8Array(buildNumber(data))
      ]).buffer; 
    }
    case 'boolean': {
      return Uint8Array.from([
        1,
        data ? 1 : 0
      ]).buffer; 
    }
    case 'string': {
      return Uint8Array.from([
        2,
        ... new Uint8Array(buildString(data))
      ]).buffer;  
    }
    case 'object': { // Object
      if (Array.isArray(data)) {
        return Uint8Array.from([
          10,
          ... new Uint8Array(buildArray(data))
        ]).buffer;  
      } else {
        return Uint8Array.from([
          3,
          ... new Uint8Array(buildObject(data))
        ]).buffer;  
      }
    }
    default: {
      return new ArrayBuffer(0);
    }
  }
}

export default (... data: any[]): any => {
  const result = data.map((o) => buildValue(o));

  let bytes = 0;
  result.forEach((r) => { bytes += r.byteLength; })

  const buffer = new ArrayBuffer(bytes);
  const uint8 = new Uint8Array(buffer);

  for (let i = 0, offset = 0; i < result.length; offset += result[i++].byteLength) {
    uint8.set(new Uint8Array(result[i]), offset);
  }

  return result;
}

