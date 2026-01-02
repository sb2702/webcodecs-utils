# webcodecs-utils

Utility functions for working with the WebCodecs API, extracted from [WebCodecs Fundamentals](https://webcodecsfundamentals.com).

## Installation

```bash
npm install webcodecs-utils
```

## Quick Start

```typescript
import { getBitrate, GPUDrawImage, MP3Encoder } from 'webcodecs-utils';

// Calculate optimal bitrate
const bitrate = getBitrate(1920, 1080, 30, 'good');

// Zero-copy video rendering with WebGPU
const renderer = new GPUDrawImage(canvas);
await renderer.init();
renderer.drawImage(videoFrame, 0, 0);

// Encode audio to MP3
const encoder = new MP3Encoder({
  sampleRate: 44100,
  bitRate: 192,
  channels: 2
});
```

## Utilities

### Video

#### **getBitrate**
Calculate optimal bitrate for video encoding based on resolution, framerate, and quality.

- 📄 [Source](./src/video/get-bitrate.ts)
- 🎮 [Demo](./demos/bitrate-demo.html)

```typescript
function getBitrate(
  width: number,
  height: number,
  fps: number,
  quality?: 'low' | 'good' | 'high' | 'very-high'
): number
```

#### **getCodecString**
Generate proper codec strings (avc1, vp09, etc.) with correct profile/level for VideoEncoder configuration.

- 📄 [Source](./src/video/get-codec-string.ts)
- 🎮 [Demo](./demos/codec-string-demo.html)

```typescript
function getCodecString(
  codec: 'avc' | 'hevc' | 'vp8' | 'vp9' | 'av1',
  width: number,
  height: number,
  bitrate: number
): string
```

#### **GPUDrawImage**
Zero-copy video frame rendering using WebGPU importExternalTexture, with fallback to ImageBitmapRenderer.

- 📄 [Source](./src/video/gpu-draw-image.ts)
- 🎮 [Demo](./demos/gpu-renderer-demo.html)

```typescript
class GPUDrawImage {
  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options?: {
    filterMode?: 'linear' | 'bicubic'
  })

  async init(): Promise<void>
  drawImage(videoFrame: VideoFrame, dx?: number, dy?: number): void
  getMode(): 'webgpu' | 'bitmap' | null
  destroy(): void
}
```

### Audio

#### **extractAudioChannels**
Extract and de-interleave audio channels from AudioData into Float32Array[].

- 📄 [Source](./src/audio/extract-audio-channels.ts)
- 🎮 [Demo](./demos/audio-channels-demo.html)

```typescript
function extractAudioChannels(audioData: AudioData): Float32Array[]
```

#### **MP3Encoder**
Encode AudioData to MP3 format using LameJS.

- 📄 [Source](./src/audio/mp3-encoder.ts)
- 🎮 [Demo](./demos/mp3-encoder-demo.html)

```typescript
class MP3Encoder {
  constructor(config: {
    sampleRate: number;
    bitRate: number;
    channels: number;
  })

  processBatch(audioData: AudioData): Uint8Array
  finish(): Blob
}
```

### Demux

#### **MP4Demuxer**
Parse MP4 files and extract EncodedVideoChunk/EncodedAudioChunk objects using MP4Box.

- 📄 [Source](./src/demux/mp4-demuxer.ts)
- 🎮 [Demo](./demos/mp4-demuxer-demo.html)

```typescript
class MP4Demuxer {
  async parseMetadata(file: File): Promise<MP4Data>
  async extractSegment(
    file: File,
    trackType: 'audio' | 'video',
    startTime: number,
    endTime: number
  ): Promise<EncodedVideoChunk[] | EncodedAudioChunk[]>
}
```

## Browser Support

These utilities require:
- **WebCodecs API** - Chrome 94+, Edge 94+, Safari 17.4+ (some features)
- **WebGPU** (optional) - Chrome 113+, Edge 113+, Safari 18+ (for GPUDrawImage)

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

- [WebCodecs Fundamentals](https://webcodecsfundamentals.com) - Comprehensive WebCodecs guide
- [MediaBunny](https://mediabunny.dev/) - Full-featured WebCodecs library
