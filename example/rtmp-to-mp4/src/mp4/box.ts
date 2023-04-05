const toUint16BE = (value: number) => {
  return [
    (value & 0xFF00) >>> 8,
    (value & 0x00FF) >>> 0,
  ]
}
const toUint32BE = (value: number) => {
  return [
    (value & 0xFF000000) >>> 24,
    (value & 0x00FF0000) >>> 16,
    (value & 0x0000FF00) >>> 8,
    (value & 0x000000FF) >>> 0,
  ]
}
const toUint64BE = (value: number) => {
  return [
    ... toUint32BE(Math.floor(value / (2 ** 32))),
    ... toUint32BE(value % (2 ** 32))
  ]
}

const fill= <T>(value: T, fill: number) => {
  const result = [];
  for (let i = 0; i < fill; i++) { result.push(value); }
  return result;
}

const toASCII = (ascii: string) => {
  return Array.from(ascii).map((c) => c.charCodeAt(0))
}

export const box = (type: string, ... data: ArrayBuffer[]) => {
  const total = data.reduce((prev, curr) => prev + curr.byteLength, 0);

  let size = 8 + total, offset = 8;
  if (size + 8 >= 2 ** 32) { size += 8; offset += 8; }

  const box = new ArrayBuffer(size);
  const view = new DataView(box);
  const uint8 = new Uint8Array(box);

  view.setUint32(0, size < 2 ** 32 ? size : 1, false);
  view.setUint8(4, type.charCodeAt(0));
  view.setUint8(5, type.charCodeAt(1));
  view.setUint8(6, type.charCodeAt(2));
  view.setUint8(7, type.charCodeAt(3));
  if (size >= 2 ** 32) {
    view.setUint32(8, Math.floor(size / (2 ** 32)));
    view.setUint32(12, size % (2 ** 32));
  }
  for (let i = 0; i < data.length; offset += data[i++].byteLength) {
    uint8.set(new Uint8Array(data[i]), offset);
  }

  return box;
};

export const fullbox = (type: string, version: number, flags: number, ... data: ArrayBuffer[]) => {
  const header = new ArrayBuffer(4);
  const view = new DataView(header);
  view.setUint32(0, flags & 0x00FFFFFF, false)
  view.setUint8(0, version);
  return box(type, header, ... data);
}

export const ftyp = () => {
  return box('ftyp', Uint8Array.from([
    ... toASCII('isom'), // major_brand: isom
    0x0,  0x0,  0x0,  0x1,   // minor_version: 0x01
    ... toASCII('isom'),
    ... toASCII('avc1')
  ]).buffer);
};

export type Movie = {
  timescale: number,
  duration?: number
};
export type HdlrType = {
  soun: 'soun',
  vide: 'vide'
};
export type CodecType = {
  avc1: 'avc1',
  hvc1: 'hvc1',
  mp4a: 'mp4a'
}

export type Track = {
  trackId: number,
  handler: keyof HdlrType,
  codec: keyof CodecType,
  config: ArrayBuffer,
  timescale: number,
  duration?: number
  width?: number,
  height?: number
  channelCount?: number,
  sampleRate?: number,
}

export const moov = (movie: Movie, tracks: Track[]) => {
  return box('moov',
    mvhd(movie),
    ... tracks.map((track) => trak(track)),
    mvex(tracks)
  );
};

const composition_matrix = [
  0x00, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x40, 0x00, 0x00, 0x00, 
];

export const mvhd = (movie: Pick<Movie, 'timescale' | 'duration'>) => {
  const { timescale, duration = 0 } = movie;
  const version = duration >= 2 ** 32 ? 1 : 0;

  return fullbox('mvhd', version, 0, Uint8Array.from([
    ... (version === 0 ? toUint32BE(0) : toUint64BE(0)),  // creation_time: 8bytes or 4bytes
    ... (version === 0 ? toUint32BE(0) : toUint64BE(0)),  // modification_time: 8bytes or 4bytes
    ... toUint32BE(timescale),  // timescale: 4 bytes
    ... (version === 0 ? toUint32BE(duration) : toUint64BE(duration)), // duration: 8 bytes or 4 bytes
    0x00, 0x01, 0x00, 0x00,  // Preferred rate: 1.0
    0x01, 0x00, 0x00, 0x00,  // PreferredVolume(1.0, 2bytes) + reserved(2bytes)
    ... fill(0, 4 * 2), // reserved: 4 + 4 bytes
    ... composition_matrix, // composition_matrix
    ... fill(0, 4 * 6), // pre_defined 6 * 4 byte
    ... fill(0xFF, 4), // next_track_ID
  ]).buffer);
};

export const trak = (track: Track) => {
  return box('trak', tkhd(track), mdia(track));
};

export const tkhd = (track: Pick<Track, 'trackId' | 'duration' | 'width' | 'height'>) => {
  const { trackId, duration = 0, width = 0, height = 0 } = track;
  const version = duration >= 2 ** 32 ? 1 : 0;

  return fullbox('tkhd', version, 0, Uint8Array.from([
    ... (version === 0 ? toUint32BE(0) : toUint64BE(0)),  // creation_time: 8bytes or 4bytes
    ... (version === 0 ? toUint32BE(0) : toUint64BE(0)),  // modification_time: 8bytes or 4bytes
    ... toUint32BE(trackId),  // timescale: 4 bytes
    ... (version === 0 ? toUint32BE(duration) : toUint64BE(duration)), // duration: 8 bytes or 4 bytes
    ... fill(0, 4 * 2), // reserved: 4 + 4 bytes
    ... fill(0, 4 * 2), // layer(2bytes) + alternate_group(2bytes), volume(2bytes) + reserved(2bytes)
    ... composition_matrix, // composition_matrix
    ... fill(0xFF, 4), // next_track_ID
    ... toUint16BE(width), 0x00, 0x00, // width
    ... toUint16BE(height), 0x00, 0x00
  ]).buffer);
};

export const mdia = (track: Track) => {
  return box('mdia',
    mdhd(track),
    hdlr(track),
    minf(track)
  );
};

export const mdhd = (track: Pick<Track, 'timescale' | 'duration'>) => {
  const { timescale, duration = 0 } = track;
  const version = duration >= 2 ** 32 ? 1 : 0;

  return fullbox('mdhd', version, 0, Uint8Array.from([
    ... (version === 0 ? toUint32BE(0) : toUint64BE(0)),  // creation_time: 8bytes or 4bytes
    ... (version === 0 ? toUint32BE(0) : toUint64BE(0)),  // modification_time: 8bytes or 4bytes
    ... toUint32BE(timescale),  // timescale: 4 bytes
    ... (version === 0 ? toUint32BE(duration) : toUint64BE(duration)), // duration: 8 bytes or 4 bytes
    0x55, 0xC4, ... toUint16BE(0)// language: und (undetermined), pre_defined = 0
  ]).buffer);
};

export const hdlr = (track: Pick<Track, 'handler'>) => {
  const { handler } = track;

  return fullbox('hdlr', 0, 0, Uint8Array.from([
    ... toUint32BE(0), // pre_defined
    ... toASCII(handler.slice(0, 4)), // handler_type
    ... fill(0, 3 * 4), // reserved: 3 * 4 bytes
    0x00, // null (empty string)
  ]).buffer);
};

export const minf = (track: Track) => {
  const { handler } = track;
  
  let xmhd: ArrayBuffer = box('null', new ArrayBuffer(0));
  if (handler.startsWith('vide')) {
    xmhd = fullbox('vmhd', 0, 0, Uint8Array.from([
      ... fill(0, 8), // graphicsmode: 2 bytes, opcolor: 3 * 2 bytes
    ]).buffer);
  } else if (handler.startsWith('soun')) {
    xmhd = fullbox('smhd', 0, 0, Uint8Array.from([
      ... fill(0, 4), // balance(2) + reserved(2)
    ]).buffer);
  }
  return box('minf', xmhd, dinf(), stbl(track));
}

export const stbl = (track: Track) => {
  return box('stbl',
    stsd(track),
    fullbox('stts', 0, 0, Uint8Array.from([... fill(0, 4)]).buffer),
    fullbox('stsc', 0, 0, Uint8Array.from([... fill(0, 4)]).buffer),
    fullbox('stsz', 0, 0, Uint8Array.from([... fill(0, 8)]).buffer),
    fullbox('stco', 0, 0, Uint8Array.from([... fill(0, 4)]).buffer),
  ); 
}

export const stsd = (track: Track) => {
  const { codec } = track;

  let codecBox = box('null', new ArrayBuffer(0));
  if (codec === 'mp4a') {
    codecBox = mp4a(track);
  } else if (codec === 'avc1') {
    codecBox = avc1(track);
  } else if (codec === 'hvc1') {
    codecBox = hvc1(track);
  }
  
  return fullbox('stsd', 0, 1, Uint8Array.from([
    ... toUint32BE(1), // entry count
  ]).buffer, codecBox);
};

export const mp4a = (track: Pick<Track, 'config' | 'channelCount' | 'sampleRate'>) => {
  const { channelCount = 0, sampleRate = 0 } = track;

  return box('mp4a', Uint8Array.from([
    ... fill(0, 4), // reserved(4)
    ... toUint16BE(0), ... toUint16BE(1), // reserved(2) + data_reference_index(2)
    ... fill(0, 4 * 2), // reserved: 2 * 4 bytes
    ... toUint16BE(channelCount), ... toUint16BE(0x10), // channelCount(2) +  sampleSize(2)
    ... fill(0, 4), //  reserved(4)
    ... toUint16BE(sampleRate), ... fill(0, 2) // // Audio sample rate
  ]).buffer, esds(track), Uint8Array.from([0x06, 0x01, 0x02]).buffer);
};

export const esds = (track: Pick<Track, 'config'>) => {
  const { config } = track;
  
  return fullbox('esds', 0, 0, Uint8Array.from([
    0x03, // descriptor_type
    0x17 + config.byteLength, // length
    ... toUint16BE(1), // es_id
    0x00, // stream_priority
    0x04, // descriptor_type
    0x0F + config.byteLength, // length
    0x40, // codec: mpeg4_audio
    0x15, // stream_type: Audio
    0x00, 0x00, 0x00, // buffer_size
    ... toUint32BE(0), // maxBitrate
    ... toUint32BE(0), // avgBitrate
    0x05, // descriptor_type
    config.byteLength // length
  ]).buffer, config);
}

export const avc1 = (track: Pick<Track, 'config' | 'width' | 'height'>) => {
  const { config, width = 0, height = 0 } = track;

  return box('avc1', Uint8Array.from([
    ... fill(0, 4), // reserved(4) 
    0x00, 0x00, 0x00, 0x01,  // reserved(2) + data_reference_index(2)
    0x00, 0x00, 0x00, 0x00,  // pre_defined(2) + reserved(2)
    ... fill(0, 3 * 4),      // pre_defined: 3 * 4 bytes
    ... toUint16BE(width), ... toUint16BE(height), // width 2bytes, height: 2 bytes
    0x00, 0x48, 0x00, 0x00,  // horizresolution: 4 bytes divide 2bytes
    0x00, 0x48, 0x00, 0x00,  // vertresolution: 4 bytes divide 2bytes
    ... fill(0, 4),          // reserved: 4 bytes
    ... toUint16BE(1),       // frame_count
    ... fill(0, 32),         // compressorname (strlen, 1byte, total 32bytes)
    ... toUint16BE(0x18), ...toUint16BE(0xFFFF) // depth, pre_defined = -1
  ]).buffer, box('avcC', config));
}

export const hvc1 = (track: Pick<Track, 'config' | 'width' | 'height'>) => {
  const { config, width = 0, height = 0 } = track;

  return box('hvc1', Uint8Array.from([
    ... fill(0, 4), // reserved(4) 
    0x00, 0x00, 0x00, 0x01,  // reserved(2) + data_reference_index(2)
    0x00, 0x00, 0x00, 0x00,  // pre_defined(2) + reserved(2)
    ... fill(0, 3 * 4),      // pre_defined: 3 * 4 bytes
    ... toUint16BE(width), ... toUint16BE(height), // width 2bytes, height: 2 bytes
    0x00, 0x48, 0x00, 0x00,  // horizresolution: 4 bytes divide 2bytes
    0x00, 0x48, 0x00, 0x00,  // vertresolution: 4 bytes divide 2bytes
    ... fill(0, 4),          // reserved: 4 bytes
    ... toUint16BE(1),       // frame_count
    ... fill(0, 32),         // compressorname (strlen, 1byte, total 32bytes)
    ... toUint16BE(0x18), ...toUint16BE(0xFFFF) // depth, pre_defined = -1
  ]).buffer, box('hvcC', config));
}

export const dinf = () => {
  return box('dinf', fullbox('dref', 0, 0, 
    Uint8Array.from([
      ... toUint32BE(1), // entry_count,
    ]).buffer,
    fullbox('url ', 0, 1)
  ));
}

export const mvex = (tracks: Track[]) => {
  return box('mvex', ... tracks.map((track) => trex(track)));
};

export const trex = (track: Pick<Track, 'trackId'>) => {
  const { trackId } = track;
  return fullbox('trex', 0, 0, Uint8Array.from([
    ... toUint32BE(trackId), // TrackId
    ... toUint32BE(1), // default_sample_description_index
    ... toUint32BE(0), // default_sample_duration
    ... toUint32BE(0), // default_sample_size
    ... toUint32BE(0x00010001), // default_sample_flags
  ]).buffer);
}

// TODO: NEEDS CHECK!

export type Sample = {
  duration: number;
  size: number;
  flags: {
    isLeading: boolean,
    dependsOn: boolean,
    isDependedOn: boolean,
    hasRedundancy: boolean,
    isNonSync: boolean,
  };
  compositionTimeOffset?: number
}

export type Fragment = {
  trackId: number,
  duration: number,
  dataOffset?: number,
  baseMediaDecodeTime: number,
  sampleCount: number,
  samples: Sample[]
}

export const moof = (sequence_number: number, fragments: Fragment[]) => {
  const moofSize = box('moof', mfhd(sequence_number), ... fragments.map((fragment) => traf(fragment, 0))).byteLength;
  return box('moof', mfhd(sequence_number), ... fragments.map((fragment) => traf(fragment, moofSize)))
}

export const mfhd = (sequence_number: number) => {
  return fullbox('mfhd', 0, 0, Uint8Array.from([
    ... toUint32BE(0),
    ... toUint32BE(sequence_number)
  ]).buffer);
}

export const traf = (fragment: Fragment, moofSize: number) => {
  return box('traf', tfhd(fragment), tfdt(fragment), trun(fragment, moofSize ));
}

export const tfhd = (fragment: Pick<Fragment, 'trackId' | 'duration'>) => {
  const { trackId, duration } = fragment;
  
  return fullbox('tfhd', 0, 8, Uint8Array.from([
    ... toUint32BE(trackId),
    ... toUint32BE(duration),
  ]).buffer);
}

export const trun = (fragment: Pick<Fragment, 'sampleCount' | 'dataOffset' | 'samples'>, moofSize: number) => {
  const { sampleCount, dataOffset, samples } = fragment;
  
  return fullbox('trun', 0, 0x000F01, Uint8Array.from([
    ... toUint32BE(sampleCount),
    ... toUint32BE(moofSize + 8 /* TODO: Needs mdat header size */ + (dataOffset ?? 0)),
    ... fill(null, sampleCount).flatMap((_, index) => [
      ... toUint32BE(samples[index].duration),
      ... toUint32BE(samples[index].size),
      // flags
      ((samples[index].flags.isLeading ? 1 : 0) << 2) | ((samples[index].flags.dependsOn ? 1 : 0) << 0),
      ((samples[index].flags.isDependedOn ? 1 : 0) << 6) | ((samples[index].flags.hasRedundancy ? 1 : 0) << 4) | ((samples[index].flags.isNonSync ? 1 : 0) << 0),
      ... toUint16BE(0), // sample_degradation_priority
      ... toUint32BE(samples[index].compositionTimeOffset ?? 0)
    ])
  ]).buffer);
}

export const tfdt = (fragment: Pick<Fragment, 'baseMediaDecodeTime'>) => {
  const { baseMediaDecodeTime } = fragment;
  const version = baseMediaDecodeTime >= 2 ** 32 ? 1 : 0;
  
  return fullbox('tfdt', version, 0, Uint8Array.from([
    ... (version === 1 ? toUint64BE(baseMediaDecodeTime) : toUint32BE(baseMediaDecodeTime))
  ]).buffer);
}

export const mdat = (... data: ArrayBuffer[]) => {
  return box('mdat', ... data);
}