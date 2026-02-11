/**
 * TransformStream that decodes EncodedVideoChunks into VideoFrames
 * Handles backpressure from both the decoder's internal queue and downstream
 */
export class VideoDecodeStream extends TransformStream<EncodedVideoChunk, VideoFrame> {
  constructor(
    config: VideoDecoderConfig,
    options?: {
      highWaterMark?: number;
      maxDecodeQueueSize?: number;
    }
  ) {
    let decoder: VideoDecoder;
    const highWaterMark = options?.highWaterMark ?? 10;
    const maxDecodeQueueSize = options?.maxDecodeQueueSize ?? 20;

    super(
      {
        start(controller) {
          decoder = new VideoDecoder({
            output: (frame) => {
              controller.enqueue(frame);
            },
            error: (e) => {
              console.error('VideoDecoder error:', e);
              controller.error(e);
            },
          });

          decoder.configure(config);
        },

        async transform(chunk, controller) {
          // Backpressure check 1: decoder's internal queue
          while (decoder.decodeQueueSize >= maxDecodeQueueSize) {
            await new Promise((r) => setTimeout(r, 10));
          }

          // Backpressure check 2: downstream buffer
          while (controller.desiredSize !== null && controller.desiredSize < 0) {
            await new Promise((r) => setTimeout(r, 10));
          }

          decoder.decode(chunk);
        },

        async flush() {
          // Wait for all pending frames to be decoded
          await decoder.flush();

          try {
            decoder.close();
          } catch (e) {
            console.error('Error closing decoder:', e);
          }
        },
      },
      { highWaterMark }
    );
  }
}
