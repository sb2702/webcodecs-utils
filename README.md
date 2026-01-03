# webcodecs-utils

Utility functions for working with the WebCodecs API, extracted from [WebCodecs Fundamentals](https://webcodecsfundamentals.org).

## Installation

```bash
npm install webcodecs-utils
```

## Quick Start

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
