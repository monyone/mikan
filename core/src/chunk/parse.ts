export type Chunk = {
  chunk_stream_id: number;
  timestamp: number;
  message_length: number;
  message_type_id: number;
  message_stream_id: number;
  message: ArrayBuffer[];
}