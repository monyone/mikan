import buildChunk from "../chunk/sender";
import buildAMF from "../amf0/builder";

export const generateWindowAcknowledgementSize = (time: number, size: number): ArrayBuffer[] => {
  const message = new ArrayBuffer(4);
  const view = new DataView(message);
  view.setUint32(0, size);

  return buildChunk({
    chunk_stream_id: 2,
    timestamp: time,
    message_type_id: 5,
    message_stream_id: 0,
    message: [message]
  });
}

export const generateSetPeerBandwidth = (time: number, size: number, limit: number): ArrayBuffer[] => {
  const message = new ArrayBuffer(5);
  const view = new DataView(message);
  view.setUint32(0, size);
  view.setUint8(4, limit);

  return buildChunk({
    chunk_stream_id: 2,
    timestamp: time,
    message_type_id: 1,
    message_stream_id: 0,
    message: [message]
  });
}

export const generateUserStreamBegin = (time: number, stream_id: number): ArrayBuffer[] => {
  const message = new ArrayBuffer(6);
  const view = new DataView(message);
  view.setUint16(0, 0);
  view.setUint32(2, stream_id);

  return buildChunk({
    chunk_stream_id: 2,
    timestamp: time,
    message_type_id: 4,
    message_stream_id: 0,
    message: [message]
  });
}

export const generateSetChunkSize = (time: number, size: number): ArrayBuffer[] => {
  const message = new ArrayBuffer(4);
  const view = new DataView(message);
  view.setUint32(0, size);

  return buildChunk({
    chunk_stream_id: 2,
    timestamp: time,
    message_type_id: 1,
    message_stream_id: 0,
    message: [message]
  });
}

export const generateConnectResult = (time: number, transaction_id: number): ArrayBuffer[] => {
  return buildChunk({
    chunk_stream_id: 2,
    timestamp: time,
    message_type_id: 20,
    message_stream_id: 0,
    message: buildAMF('_result', transaction_id, {
      fmsVer: 'FMS/3,5,7,7009',
      capabilities: 31,
      mode: 1,
    }, {
      code: 'NetConnection.Connect.Success',
      description: 'Connection succeeded.',
      data: {
        version: '3,5,7,7009',
      },
      objectEncoding: 0,
      level: 'status',
    })
  });
}