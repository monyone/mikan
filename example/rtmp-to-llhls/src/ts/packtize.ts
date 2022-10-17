import { PACKET_SIZE, HEADER_SIZE, SYNC_BYTE, STUFFING_BYTE } from './packet'

const PES_HEADER_SIZE = 6;
export const has_flags = (stream_id: number) => {
  return (stream_id !== 0xBC) && (stream_id !== 0xBE) && (stream_id !== 0xBF) && (stream_id !== 0xF0) && (stream_id !== 0xF1) && (stream_id !== 0xFF) && (stream_id !== 0xF2) && (stream_id !== 0xF8);
}

export const packtizeSection = (
  section: Buffer,
  transport_error_indicator: boolean,
  transport_priority: boolean,
  pid: number,
  transport_scrambling_control: number,
  continuity_counter: number,
): Buffer[] => {
  const result: Buffer[] = [];

  let begin = 0;
  while (begin < section.length) {
    const header = Buffer.from([
      SYNC_BYTE,
      ((transport_error_indicator ? 1 : 0) << 7) | ((begin === 0 ? 1 : 0) << 6) | ((transport_priority ? 1 : 0) << 5) | ((pid & 0x1F00) >> 8),
      (pid & 0x00FF),
      (transport_scrambling_control << 6) | (1 << 4) | (continuity_counter & 0x0F),
    ]);
    continuity_counter = (continuity_counter + 1) & 0x0F;

    const next = Math.min(section.length, begin + ((PACKET_SIZE - HEADER_SIZE) - (begin === 0 ? 1 : 0)));
    let payload = section.slice(begin, next);
    if (begin === 0) { payload = Buffer.concat([Buffer.alloc(1), payload]); }
    const fillStuffingSize = Math.max(0, PACKET_SIZE - (HEADER_SIZE + payload.length))
    payload = Buffer.concat([payload, Buffer.alloc(fillStuffingSize, STUFFING_BYTE)]);

    const packet = Buffer.concat([header, payload]);
    result.push(packet)

    begin = next;
  }

  return result;
}

export const packtizePES = (
  data: Buffer,
  transport_error_indicator: boolean,
  transport_priority: boolean,
  pid: number,
  transport_scrambling_control: number,
  continuity_counter: number,
  pes_length_omit: boolean,
  stream_id: number,
  pts?: number,
  dts?: number,
): Buffer[] => {
  const result: Buffer[] = [];

  if (!has_flags(stream_id)) {
    pts = undefined;
    dts = undefined;
  }
  const PTS = pts != null ? Buffer.from([
    ((pts != null ? 0b00100000 : 0) | (dts != null ? 0b00010000 : 0) | (((pts / (1 << 30)) & 0x7) << 1) | 1),
    ((((pts >>> 0) & 0x3FC00000) >> 22)),
    ((((pts >>> 0) & 0x003F8000) >> 15) << 1) | 1,
    ((((pts >>> 0) & 0x00007F80) >>  7)),
    ((((pts >>> 0) & 0x0000007F) >>  0) << 1) | 1,
  ]) : Buffer.from([]);
  const DTS = dts != null ? Buffer.from([
    ((dts != null ? 0b00010000 : 0) | (((dts / (1 << 30)) & 0x7) << 1) | 1),
    ((((dts >>> 0) & 0x3FC00000) >> 22)),
    ((((dts >>> 0) & 0x003F8000) >> 15) << 1) | 1,
    ((((dts >>> 0) & 0x00007F80) >>  7)),
    ((((dts >>> 0) & 0x0000007F) >>  0) << 1) | 1,
  ]) : Buffer.from([]);

  const PES_header_data_length = (PTS.byteLength ?? 0) + (DTS.byteLength ?? 0);
  const pes = Buffer.concat([
    Buffer.from([
      0, 0, 1,
      stream_id,
      0, 0,
    ]),
    Buffer.concat(has_flags(stream_id) ? [
      Buffer.from([0x80, (pts != null ? 0b10000000 : 0) | (dts != null ? 0b01000000 : 0)]),
      Buffer.from([PES_header_data_length]),
      PTS,
      DTS
    ] : []),
    data
  ]);

  if (!pes_length_omit) {
    pes[4] = ((pes.byteLength - PES_HEADER_SIZE) & 0xFF00) >> 8;
    pes[5] = ((pes.byteLength - PES_HEADER_SIZE) & 0x00FF) >> 0;
  };

  for (let i = 0; i < pes.byteLength; i += PACKET_SIZE - HEADER_SIZE) {
    const payload = pes.slice(i, Math.min(pes.byteLength, i + 184));
    const header = Buffer.from([
      SYNC_BYTE,
      ((transport_error_indicator ? 1 : 0) << 7) | ((i === 0 ? 1 : 0) << 6) | ((transport_priority ? 1 : 0) << 5) | ((pid & 0x1F00) >> 8),
      (pid & 0x00FF),
      (transport_scrambling_control << 6) | ((PACKET_SIZE - HEADER_SIZE) > payload.byteLength ? 0x30 : 0x10) | (continuity_counter & 0x0F),
    ]);
    continuity_counter = (continuity_counter + 1) & 0x0F;

    const packet = Buffer.concat([
      header,
      Buffer.from((payload.byteLength < (PACKET_SIZE - HEADER_SIZE))
        ? [(PACKET_SIZE - HEADER_SIZE - 1) - payload.byteLength]
        : []
      ),
      Buffer.from((payload.byteLength < (PACKET_SIZE - HEADER_SIZE - 1))
        ? [0x00]
        : []
      ),
      ((payload.byteLength < (PACKET_SIZE - HEADER_SIZE - 2))
        ? Buffer.alloc((PACKET_SIZE - HEADER_SIZE - 2) - payload.length, 0xFF)
        : Buffer.from([])
      ),
      payload,
    ]);
    result.push(packet);
  }

  return result;
}

export const packtizePCR = (
  transport_error_indicator: boolean,
  transport_priority: boolean,
  pid: number,
  transport_scrambling_control: number,
  continuity_counter: number,
  pcr: number
): Buffer => {
  return Buffer.concat([
    Buffer.from([
      SYNC_BYTE,
      ((transport_error_indicator ? 1 : 0) << 7) | (0 << 6) /* pcr is not payload */ | ((transport_priority ? 1 : 0) << 5) | ((pid & 0x1F00) >> 8),
      (pid & 0x00FF),
      (transport_scrambling_control << 6) | 0x20 /* adaptation only */ | (continuity_counter & 0x0F),
      PACKET_SIZE - HEADER_SIZE - 1,
      0x10,
      (pcr / (2 ** 25)) & 0xFF,
      ((pcr >>> 0) / (2 ** 17)) & 0xFF,
      ((pcr >>> 0) / (2 ** 9)) & 0xFF,
      ((pcr >>> 0) / (2 ** 1)) & 0xFF,
      ((pcr >>> 0) & 0x01) << 7,
    ]),
    Buffer.alloc(PACKET_SIZE - HEADER_SIZE - 7, 0xFF)
  ]);
}