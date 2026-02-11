/**
 * TransformStream that applies a custom processing function to each VideoFrame
 * The transform function receives a frame and should return a new processed frame
 *
 * @example
 * ```typescript
 * const upscaler = new VideoProcessStream(async (frame) => {
 *   await websr.render(frame);
 *   const upscaledFrame = new VideoFrame(canvas, {
 *     timestamp: frame.timestamp,
 *     duration: frame.duration
 *   });
 *   return upscaledFrame;
 * });
 * ```
 */
export class VideoProcessStream extends TransformStream<VideoFrame, VideoFrame> {
  constructor(
    transformFn: (frame: VideoFrame) => Promise<VideoFrame> | VideoFrame,
    options?: {
      highWaterMark?: number;
    }
  ) {
    const highWaterMark = options?.highWaterMark ?? 5;

    super(
      {
        async transform(frame, controller) {
          try {
            // Apply the custom transform function
            const processedFrame = await transformFn(frame);

            // Enqueue the processed frame
            controller.enqueue(processedFrame);

            // Close the original frame if it's different from the processed one
            if (processedFrame !== frame) {
              frame.close();
            }
          } catch (error) {
            console.error('VideoProcessStream error:', error);
            frame.close();
            controller.error(error);
          }
        },
      },
      { highWaterMark }
    );
  }
}
