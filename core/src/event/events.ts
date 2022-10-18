export const EventTypes = {
  RTMP_CHUNK_RECIEVED: 'RTMP_CHUNK_RECIEVED',
  RTMP_CHUNK_SEND: 'RTMP_CHUNK_SEND',

  RTMP_APP_INVALID: 'RTMP_STREAMKEY_INVALID',
  RTMP_STREAMKEY_INVALID: 'RTMP_STREAMKEY_INVALID',

  RTMP_PUBLISHED: 'RTMP_PUBLISHED',
  RTMP_TERMINATED: 'RTMP_TERMINATED',

  FLV_CHUNK_OUTPUT: 'FLV_CHUNK_OUTPUT' 
} as const;

export type RTMP_CHUNK_RECIEVED_PAYLOAD = {
  event: typeof EventTypes.RTMP_CHUNK_RECIEVED,
  chunk: ArrayBuffer
}

export type RTMP_CHUNK_SEND_PAYLOAD = {
  event: typeof EventTypes.RTMP_CHUNK_SEND,
  chunk: ArrayBuffer
}

export type RTMP_APP_INVALID_PAYLOAD = {
  event: typeof EventTypes.RTMP_APP_INVALID;
  required: string,
  actual: string
}

export type RTMP_STREAMKEY_INVALID_PAYLOAD = {
  event: typeof EventTypes.RTMP_STREAMKEY_INVALID;
  required: string,
  actual: string
}

export type RTMP_PUBLISHED_PAYLOAD = {
  event: typeof EventTypes.RTMP_PUBLISHED,
  app: string,
  streamKey: string,
  messageId: number
}

export type RTMP_TERMINATED_PAYLOAD = {
  event: typeof EventTypes.RTMP_TERMINATED,
  app: string,
  streamKey: string,
  messageId: number
}

export type FLV_CHUNK_OUTPUT_PAYLOAD = {
  event: typeof EventTypes.FLV_CHUNK_OUTPUT,
  chunk: ArrayBuffer
}

export type Events = {
  [EventTypes.RTMP_CHUNK_RECIEVED]: RTMP_CHUNK_RECIEVED_PAYLOAD,
  [EventTypes.RTMP_CHUNK_SEND]: RTMP_CHUNK_SEND_PAYLOAD

  [EventTypes.RTMP_APP_INVALID]: RTMP_APP_INVALID_PAYLOAD,
  [EventTypes.RTMP_STREAMKEY_INVALID]: RTMP_STREAMKEY_INVALID_PAYLOAD,
  
  [EventTypes.RTMP_PUBLISHED]: RTMP_PUBLISHED_PAYLOAD,
  [EventTypes.RTMP_TERMINATED]: RTMP_TERMINATED_PAYLOAD,

  [EventTypes.FLV_CHUNK_OUTPUT]: FLV_CHUNK_OUTPUT_PAYLOAD
}