// Firefox doesn't support MediaStreamTrackProcessor so we need to use a polyfill.
// Based on: https://jan-ivar.github.io/polyfills/mediastreamtrackprocessor.js
// and https://github.com/moq-dev/moq/blob/main/js/hang/src/publish/video/polyfill.ts

class MediaStreamTrackProcessorPolyfill {
  readable: ReadableStream<VideoFrame>;

  constructor({ track }: { track: MediaStreamTrack }) {

    const settings = track.getSettings();
    if (!settings) {
      throw new Error("track has no settings");
    }

    let video: HTMLVideoElement;
    let last: number;

    const frameRate = settings.frameRate ?? 30;

    this.readable = new ReadableStream<VideoFrame>({
      async start() {
        video = document.createElement("video") as HTMLVideoElement;
        video.srcObject = new MediaStream([track]);
        await Promise.all([
          video.play(),
          new Promise((r) => {
            video.onloadedmetadata = r;
          }),
        ]);

        last = performance.now();
      },
      async pull(controller) {
        while (true) {
          const now = performance.now();
          if (now - last < 1000 / frameRate) {
            await new Promise((r) => requestAnimationFrame(r));
            continue;
          }

          last = now;
          controller.enqueue(new VideoFrame(video, { timestamp: last * 1000 }));
          break;
        }
      },
    });
  }
}

// Auto-polyfill if not available
if (!self.MediaStreamTrackProcessor) {
  self.MediaStreamTrackProcessor = MediaStreamTrackProcessorPolyfill;
}

// Export native if available, polyfill otherwise
export const MediaStreamTrackProcessor = self.MediaStreamTrackProcessor || MediaStreamTrackProcessorPolyfill;
