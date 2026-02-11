# webcodecs-utils

Utility functions for working with the WebCodecs API, extracted from [WebCodecs Fundamentals](https://webcodecsfundamentals.org).

## Installation

```bash
npm install webcodecs-utils
```

## Quick Start

### Individual Utilities

```typescript
import { getBitrate, GPUFrameRenderer, extractChannels, MP4Demuxer } from 'webcodecs-utils';

// Calculate optimal bitrate (defaults to 30fps)
const bitrate = getBitrate(1920, 1080);

// Zero-copy video rendering with WebGPU
const renderer = new GPUFrameRenderer(canvas);
await renderer.init();
renderer.drawImage(videoFrame);

// Extract audio channels
const decoder = new AudioDecoder({
  output: (audioData) => {
    const channels = extractChannels(audioData);
    const leftChannel = channels[0];
    const rightChannel = channels[1];
  },
  error: (e) => console.error(e)
});

// Parse MP4 files
const demuxer = new MP4Demuxer(file);
await demuxer.load();
const videoChunks = await demuxer.extractSegment('video', 0, 10);
```

### Streaming Pipeline

```typescript
import {
  SimpleDemuxer,
  VideoDecodeStream,
  VideoProcessStream,
  VideoEncodeStream,
  SimpleMuxer
} from 'webcodecs-utils';

// Build a composable streaming pipeline with automatic backpressure
const demuxer = new SimpleDemuxer(file);
await demuxer.load();

const muxer = new SimpleMuxer({ video: 'avc' });

await demuxer.videoStream()
  .pipeThrough(new VideoDecodeStream(await demuxer.getVideoDecoderConfig()))
  .pipeThrough(new VideoProcessStream(async (frame) => {
    // Custom processing: upscaling, filters, etc.
    return frame;
  }))
  .pipeThrough(new VideoEncodeStream(encoderConfig))
  .pipeTo(muxer.videoSink());

const blob = await muxer.finalize();
```

## Utilities

### Video

#### **getBitrate**
Calculate optimal bitrate for video encoding based on resolution, framerate, and quality.

- 📄 [Source](./src/video/get-bitrate.ts)
- 🎮 [Demo](./demos/get-bitrate.html)

```typescript
function getBitrate(
  width: number,
  height: number,
  fps?: number,  // default: 30
  quality?: 'low' | 'good' | 'high' | 'very-high'  // default: 'good'
): number
```

#### **getCodecString**
Generate proper codec strings (avc1, vp09, etc.) with correct profile/level for VideoEncoder configuration.

- 📄 [Source](./src/video/get-codec-string.ts)
- 🎮 [Demo](./demos/get-codec-string.html)

```typescript
function getCodecString(
  codec: 'avc' | 'hevc' | 'vp8' | 'vp9' | 'av1',
  width: number,
  height: number,
  bitrate: number
): string
```

#### **GPUFrameRenderer**
Zero-copy video frame rendering using WebGPU importExternalTexture, with fallback to ImageBitmapRenderer.

- 📄 [Source](./src/video/gpu-renderer.ts)
- 🎮 [Demo](./demos/gpu-renderer.html)

```typescript
class GPUFrameRenderer {
  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options?: {
    filterMode?: 'linear' | 'bicubic'
  })

  async init(): Promise<void>
  drawImage(videoFrame: VideoFrame): void
  getMode(): 'webgpu' | 'bitmap' | null
  getFilterMode(): 'linear' | 'bicubic'
  setFilterMode(mode: 'linear' | 'bicubic'): void
  destroy(): void
}
```

### Audio

#### **extractChannels**
Extract and de-interleave audio channels from AudioData into Float32Array[].

Handles both planar (f32-planar) and interleaved (f32) audio formats automatically. Returns an array of Float32Array buffers, one per channel (e.g., [left, right] for stereo).

- 📄 [Source](./src/audio/extract-channels.ts)
- 🎮 [Demo](./demos/extract-channels.html)

```typescript
function extractChannels(audioData: AudioData): Float32Array[]
```

**Example:**
```typescript
const channels = extractChannels(audioData);
const leftChannel = channels[0];
const rightChannel = channels[1]; // if stereo

// Process audio samples
for (let i = 0; i < leftChannel.length; i++) {
  leftChannel[i] *= 0.5; // Reduce volume by 50%
}
```

#### **MP3Encoder**
Encode AudioData to MP3 format using LameJS.

- 📄 [Source](./src/audio/mp3.ts)
- 🎮 [Demo](./demos/mp3-encoder.html)

```typescript
class MP3Encoder {
  constructor(config: {
    sampleRate: number;
    bitRate: number;
    channels: number;
  })

  processBatch(audioData: AudioData): Uint8Array
  finish(): Blob
  getEncodedSize(): number
}
```

#### **MP3Decoder**
Decode MP3 files to raw PCM samples or AudioData objects.

- 📄 [Source](./src/audio/mp3.ts)
- 🎮 [Demo](./demos/mp3-decoder.html)

```typescript
class MP3Decoder {
  constructor()

  async initialize(): Promise<void>
  async toSamples(mp3Buffer: ArrayBuffer): Promise<{
    channels: Float32Array[],
    sampleRate: number,
    numberOfChannels: number
  }>
  async toAudioData(mp3Buffer: ArrayBuffer): Promise<AudioData[]>
  async destroy(): Promise<void>
}
```

### Demux/Mux

#### **MP4Demuxer**
Parse MP4 files and extract EncodedVideoChunk/EncodedAudioChunk objects using MP4Box.

- 📄 [Source](./src/demux/mp4-demuxer.ts)
- 🎮 [Demo](./demos/mp4-demuxer.html)

```typescript
class MP4Demuxer {
  constructor(file: File)

  async load(onProgress?: (progress: number) => void): Promise<void>
  getTracks(): TrackData
  getVideoTrack(): VideoTrackData | undefined
  getAudioTrack(): AudioTrackData | undefined
  getVideoDecoderConfig(): VideoDecoderConfig | undefined
  getAudioDecoderConfig(): AudioDecoderConfig | undefined
  async extractSegment(
    trackType: 'audio' | 'video',
    startTime: number,
    endTime: number
  ): Promise<EncodedVideoChunk[] | EncodedAudioChunk[]>
  getInfo(): MP4Info
}
```

**Example:**
```typescript
const demuxer = new MP4Demuxer(file);
await demuxer.load((progress) => console.log(`Loading: ${progress * 100}%`));

const videoTrack = demuxer.getVideoTrack();
console.log(`Video: ${videoTrack.codec}, ${videoTrack.codedWidth}x${videoTrack.codedHeight}`);

const videoChunks = await demuxer.extractSegment('video', 0, 10);
```

### Streaming Pipelines

Build production-ready video processing pipelines using the Streams API with automatic backpressure management.

- 📄 [Documentation](./src/streams/README.md)
- 🎮 [Transcode Demo](./demos/transcode-pipeline.html)
- 🎮 [AI Upscaling Demo](./demos/upscale-pipeline.html)

#### **VideoDecodeStream**
TransformStream that decodes EncodedVideoChunks into VideoFrames with automatic backpressure.

```typescript
class VideoDecodeStream extends TransformStream<EncodedVideoChunk, VideoFrame> {
  constructor(
    config: VideoDecoderConfig,
    options?: {
      highWaterMark?: number;        // default: 10
      maxDecodeQueueSize?: number;   // default: 20
    }
  )
}
```

#### **VideoEncodeStream**
TransformStream that encodes VideoFrames into EncodedVideoChunks with automatic backpressure.

```typescript
class VideoEncodeStream extends TransformStream<
  VideoFrame,
  { chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }
> {
  constructor(
    config: VideoEncoderConfig,
    options?: {
      highWaterMark?: number;        // default: 10
      maxEncodeQueueSize?: number;   // default: 20
      keyFrameInterval?: number;     // default: 60
    }
  )
}
```

#### **VideoProcessStream**
TransformStream that applies a custom processing function to each VideoFrame.

```typescript
class VideoProcessStream extends TransformStream<VideoFrame, VideoFrame> {
  constructor(
    transformFn: (frame: VideoFrame) => Promise<VideoFrame> | VideoFrame,
    options?: {
      highWaterMark?: number;  // default: 5
    }
  )
}
```

**Example - AI Upscaling:**
```typescript
import WebSR from '@websr/websr';

const websr = new WebSR({ resolution, network, weights, gpu, canvas });

const upscaleStream = new VideoProcessStream(async (frame) => {
  await websr.render(frame);  // AI upscaling with WebGPU
  return new VideoFrame(canvas, {
    timestamp: frame.timestamp,
    duration: frame.duration
  });
});

// Use in pipeline
await videoStream
  .pipeThrough(new VideoDecodeStream(config))
  .pipeThrough(upscaleStream)
  .pipeThrough(new VideoEncodeStream(config))
  .pipeTo(muxer.videoSink());
```

#### **SimpleDemuxer** ⚠️ Demo/Learning Only
Simple wrapper around web-demuxer for easier usage in demos. For production, use [web-demuxer](https://github.com/bilibili/web-demuxer) or [MediaBunny](https://mediabunny.dev/) directly.

```typescript
class SimpleDemuxer {
  constructor(file: File, options?: { wasmFilePath?: string })

  async load(): Promise<void>
  videoStream(startTime?: number): ReadableStream<EncodedVideoChunk>
  audioStream(startTime?: number): ReadableStream<EncodedAudioChunk>
  async getVideoDecoderConfig(): Promise<VideoDecoderConfig>
  async getAudioDecoderConfig(): Promise<AudioDecoderConfig>
  async getSegment(type: 'video' | 'audio', start: number, end: number): Promise<EncodedVideoChunk[] | EncodedAudioChunk[]>
  async getMediaInfo(): Promise<MediaInfo>
}
```

#### **SimpleMuxer** ⚠️ Demo/Learning Only
Simple wrapper around MediaBunny's Output for easier muxing in demos. For production, use [MediaBunny](https://mediabunny.dev/) directly.

```typescript
class SimpleMuxer {
  constructor(config: {
    video?: 'avc' | 'hevc' | 'vp8' | 'vp9' | 'av1';
    audio?: 'aac' | 'opus' | 'mp3' | 'vorbis' | 'flac';
  })

  videoSink(): WritableStream<{ chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }>
  audioSink(): WritableStream<EncodedAudioChunk>
  async finalize(): Promise<Blob>
}
```

## Browser Support

These utilities require:
- **WebCodecs API** - Chrome 94+, Edge 94+, Safari 17.4+ (some features)
- **WebGPU** (optional) - Chrome 113+, Edge 113+, Safari 18+ (for GPUFrameRenderer)

All utilities include compatibility checks and graceful degradation where applicable.

## Development

```bash
# Install dependencies
npm install

# Start demo server (localhost:5173)
npm run dev

# Build library
npm run build
```

## License

MIT

## Related

- [WebCodecs Fundamentals](https://webcodecsfundamentals.org) - Comprehensive WebCodecs guide
- [MediaBunny](https://mediabunny.dev/) - Full-featured WebCodecs library
