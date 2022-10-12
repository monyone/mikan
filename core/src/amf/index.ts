const UTF8Decoder = new TextDecoder('utf-8');

const parseString = (data: ArrayBuffer, begin: number, end: number): string => {
  const view = new DataView(data);
  const length = view.getUint16(begin + 0, false);
  return UTF8Decoder.decode(data.slice(begin + 2, begin + 2 + length));
};

const parseObject = (data: ArrayBuffer, begin: number, end: number): Object => {
  const view = new DataView(data);
  const length = view.getUint16(begin);
  const name = parseString(data, begin, begin + (2 + length));
  const value = parseValue(data, begin + (2 + length), end - (2 + length));
  return { [name]: value };
};

const parseValue = (data: ArrayBuffer, begin: number, end: number): any => {
  const view = new DataView(data);

  const tag = view.getUint8(0);
  switch (tag) {
    case 0: {
      return view.getFloat64(1, false);
    }
    case 1: {
      return !!view.getUint8(1);
    }
    case 2: {
      return parseString(data, begin + 1, end);
    }
    case 3: {
      return parseObject(data, begin + 1, end);
    }
    case 9: {
      return;
    }
    // TODO: NEED MORE!!!
  }

  throw new Error(`Unhandled Tag=${tag}`);
};

export default (data: ArrayBuffer): any => {
  return parseValue(data, 0, data.byteLength);
}