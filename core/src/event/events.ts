export const EventTypes = {
  RTMP_CHUNK_RECIEVED: 'RTMP_CHUNK_RECIEVED',
  RTMP_CHUNK_SEND: 'RTMP_CHUNK_SEND',
} as const;

export type RTMP_CHUNK_RECIEVED_PAYLOAD = {
  event: typeof EventTypes.RTMP_CHUNK_RECIEVED,
  chunk: ArrayBuffer
}

export type RTMP_CHUNK_SEND_PAYLOAD = {
  event: typeof EventTypes.RTMP_CHUNK_SEND,
  chunk: ArrayBuffer
}

export type Events = {
  [EventTypes.RTMP_CHUNK_RECIEVED]: RTMP_CHUNK_RECIEVED_PAYLOAD,
  [EventTypes.RTMP_CHUNK_SEND]: RTMP_CHUNK_SEND_PAYLOAD
}