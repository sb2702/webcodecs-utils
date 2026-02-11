/**
 * TransformStream that encodes VideoFrames into EncodedVideoChunks with metadata
 * Handles backpressure from both the encoder's internal queue and downstream
 */
export class VideoEncodeStream extends TransformStream<
  VideoFrame,
  { chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }
> {
  constructor(
    config: VideoEncoderConfig,
    options?: {
      highWaterMark?: number;
      maxEncodeQueueSize?: number;
      keyFrameInterval?: number;
    }
  ) {
    let encoder: VideoEncoder;
    let frameCount = 0;
    const highWaterMark = options?.highWaterMark ?? 10;
    const maxEncodeQueueSize = options?.maxEncodeQueueSize ?? 20;
    const keyFrameInterval = options?.keyFrameInterval ?? 60;

    super(
      {
        start(controller) {
          encoder = new VideoEncoder({
            output: (chunk, meta) => {
              controller.enqueue({ chunk, meta });
            },
            error: (e) => {
              console.error('VideoEncoder error:', e);
              controller.error(e);
            },
          });

          encoder.configure(config);
        },

        async transform(frame, controller) {
          // Backpressure check 1: encoder's internal queue
          while (encoder.encodeQueueSize >= maxEncodeQueueSize) {
            await new Promise((r) => setTimeout(r, 10));
          }

          // Backpressure check 2: downstream buffer
          while (controller.desiredSize !== null && controller.desiredSize < 0) {
            await new Promise((r) => setTimeout(r, 10));
          }

          // Encode with keyframe at intervals
          const isKeyFrame = frameCount % keyFrameInterval === 0;
          encoder.encode(frame, { keyFrame: isKeyFrame });
          frameCount++;

          // Close the frame to free memory
          frame.close();
        },

        async flush() {
          // Wait for all pending chunks to be encoded
          await encoder.flush();

          try {
            encoder.close();
          } catch (e) {
            console.error('Error closing encoder:', e);
          }
        },
      },
      { highWaterMark }
    );
  }
}
