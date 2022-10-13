const UTF8Decoder = new TextDecoder('utf-8');

const parseString = (data: ArrayBuffer, begin: number) => {
  const view = new DataView(data);
  const length = view.getUint16(begin + 0, false);

  return {
    value: UTF8Decoder.decode(data.slice(begin + 2, begin + 2 + length)),
    end: begin + 2 + length,
  };
};

const parseLongString = (data: ArrayBuffer, begin: number) => {
  const view = new DataView(data);
  const length = view.getUint32(begin + 0, false);

  return {
    value: UTF8Decoder.decode(data.slice(begin + 4, begin + 4 + length)),
    end: begin + 2 + length,
  };
};

const parseObject = (data: ArrayBuffer, begin: number) => {
  const view = new DataView(data);
  const object: Record<string, any> = {};
  while (true) {
    // fix malformed ScriptDataObjectEnd
    if (begin + 4 <= data.byteLength && (view.getUint32(begin) & 0x00FFFFFF) === 9) {
      return {
        value: object,
        end: begin + 4
      };
    }

    const { value: name, end: name_end } = parseString(data, begin);
    const { value, end: value_end, terminate } = parseValue(data, name_end);
    if (terminate) {
      return {
        value: object,
        end: value_end
      };
    }

    object[name] = value;
    begin = value_end;
  }
};

const parseMixedArray = (data: ArrayBuffer, begin: number) => {
  const view = new DataView(data);
  begin += 4;
  let array: Record<string, any> = {};
  while (true) {
    // fix malformed ScriptDataObjectEnd
    if (begin + 4 <= data.byteLength && (view.getUint32(begin) & 0x00FFFFFF) === 9) {
      return {
        value: array,
        end: begin + 4
      };
    }

    const { value, end, terminate } = parseValue(data, begin);
    if (terminate) {
      return {
        value: array,
        end: end
      };
    }

    array = {
      ... array,
      ... value
    };
    begin = end;
  }
}

const parseStrictArray = (data: ArrayBuffer, begin: number) => {
  const view = new DataView(data);
  const length = view.getUint32(begin, false);
  begin += 4;
  const end = begin + length;
  const array = [];

  while (begin < end) {
    const { value, end } = parseValue(data, begin);
    array.push(value);
    begin = end;
  }

  return {
    value: array,    
    end: end
  };
}

const parseDate = (data: ArrayBuffer, begin: number) => {
  const view = new DataView(data);
  const timestamp = view.getFloat64(begin, false);
  const localTimeOffset = view.getInt16(begin + 8, false);

  return {
    value: new Date(timestamp + localTimeOffset * 60 * 1000),
    end: begin + 10
  };
}

const parseValue = (data: ArrayBuffer, begin: number): any => {
  const view = new DataView(data);

  const tag = view.getUint8(begin + 0);
  switch (tag) {
    case 0: { // Number(Double)
      return {
        value: view.getFloat64(begin + 1, false),
        end: begin + 9,
      }
    }
    case 1: { // Boolean
      return {
        value: !!view.getUint8(1),
        end: begin + 2
      }
    }
    case 2: { // String
      return parseString(data, begin + 1)
    }
    case 3: { // Object
      return parseObject(data, begin + 1);
    }
    case 8: { // ECMA array type (Mixed array)
      return parseMixedArray(data, begin + 1);
    }
    case 9: { // ScriptDataObjectEnd
      return {
        end: begin + 1,
        terminate: true,
      }
    }
    case 10: { // Strict Array
      return parseStrictArray(data, begin + 1);
    }
    case 11: {  // Date type
      return parseDate(data, begin + 1);
    }
    case 12: { // Long String
      return parseLongString(data, begin + 1)
    }
    default: {
      throw new Error(`Unhandled Tag=${tag}`);
    }
  }
};

export default (data: ArrayBuffer): any => {
  const result = [];
  
  let begin = 0;
  while (begin < data.byteLength) {
    const { value, end } = parseValue(data, begin);
    result.push(value);
    begin = end;
  }

  return result;
}