import CRC32 from "../util/crc32";

export const buildPAT = (programs: [number, number][]) => {
  const PAT = Buffer.concat([
    Buffer.from([
      0x00, // table_id (8bit)
      0x80, // section_syntax_indicator (1bit), '0' (1bit), reserved (2bit), section_length (higher 4 bit of 12 bit)
      0, // section_length (lower 8 bit of 12 bit)
      0, 0, // transport_stream_id
      1, // reserved (2bit), version_number (5bit), current_next_indicator (1bit)
      0, // section_number
      0, // last_section_number
    ]),
    Buffer.concat(programs.map(([program_number, PID]) => {
      return Buffer.from([
        (program_number & 0xFF00) >> 8,
        (program_number & 0x00FF) >> 0,
        (PID & 0x1F00) >> 8,
        (PID & 0x00FF) >> 0,
      ]);
    }))
  ]);
  PAT[1] = (PAT[1] & 0xF0) | (((PAT.byteLength + 4 - 3) & 0x0F00) >> 8);
  PAT[2] = (((PAT.byteLength + 4 - 3) & 0x00FF) >> 0);

  const CRC = CRC32(PAT);
  return Buffer.concat([
    PAT,
    Buffer.from([
      (CRC & 0xFF000000) >>> 24,
      (CRC & 0x00FF0000) >>> 16,
      (CRC & 0x0000FF00) >>> 8,
      (CRC & 0x000000FF) >>> 0
    ])
  ]);
}

export const buildPMT = (program_number: number, PCR_PID: number, elements: [number, number, Buffer][]) => {
  const descriptor = Buffer.from([]);

  const PMT = Buffer.concat([
    Buffer.from([
      0x02, // table_id (8bit)
      0x80, // section_syntax_indicator (1bit), '0' (1bit), reserved (2bit), section_length (higher 4 bit of 12 bit)
      0, // section_length (lower 8 bit of 12 bit)
      ((program_number & 0xFF00) >> 8), //program_number
      ((program_number & 0x00FF) >> 0), //program_number
      1, // reserved (2bit), version_number (5bit), current_next_indicator (1bit)
      0, // section_number
      0, // last_section_number
      ((PCR_PID & 0x1F00) >> 8), // PCR_PID (higher 5 bit of 13bit)
      ((PCR_PID & 0x00FF) >> 0), // PCR_PID (lower 8 bit of 13bit)
    ]),
    Buffer.from([
      ((descriptor.byteLength & 0x0F00) >> 8), // descritor_info_length (higher 4bit of 12bit)
      ((descriptor.byteLength & 0x00FF) >> 0), // descritor_info_length (lower 8bit of 12bit)
    ]),
    descriptor,
    Buffer.concat(elements.map(([stream_type, PID, ES_info]) => {
      return Buffer.concat([
        Buffer.from([
          stream_type & 0xFF,
          (PID & 0x1F00) >> 8,
          (PID & 0x00FF) >> 0,
          ((ES_info.byteLength & 0x0F00) >> 8),
          ((ES_info.byteLength & 0x00FF) >> 0)
        ]),
        ES_info,
      ]);
    }))
  ]);
  PMT[1] = (PMT[1] & 0xF0) | (((PMT.byteLength + 4 - 3) & 0x0F00) >> 8);
  PMT[2] = (((PMT.byteLength + 4 - 3) & 0x00FF) >> 0);

  const CRC = CRC32(PMT);
  return Buffer.concat([
    PMT,
    Buffer.from([
      (CRC & 0xFF000000) >>> 24,
      (CRC & 0x00FF0000) >>> 16,
      (CRC & 0x0000FF00) >>> 8,
      (CRC & 0x000000FF) >>> 0
    ])
  ]);
}