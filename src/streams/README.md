# Streaming Utilities

Production-ready WebCodecs streaming utilities built on the [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) with automatic backpressure management.

## Overview

These utilities allow you to build composable video processing pipelines using the Streams API pattern:

```typescript
source.pipeThrough(transform1).pipeThrough(transform2).pipeTo(sink)
```

The Streams API provides:
- **Automatic backpressure** - Downstream stages control the flow rate
- **Memory efficiency** - Bounded buffers prevent memory bloat
- **Composability** - Mix and match processing stages
- **Error handling** - Errors propagate through the pipeline

## VideoDecodeStream

Decodes `EncodedVideoChunk` objects into `VideoFrame` objects using the WebCodecs VideoDecoder API.

### API

```typescript
class VideoDecodeStream extends TransformStream<EncodedVideoChunk, VideoFrame> {
  constructor(
    config: VideoDecoderConfig,
    options?: {
      highWaterMark?: number;        // default: 10 frames
      maxDecodeQueueSize?: number;   // default: 20 chunks
    }
  )
}
```

### Parameters

- **config**: VideoDecoderConfig object (codec, width, height, etc.)
- **options.highWaterMark**: Maximum frames buffered in the output stream before applying backpressure
- **options.maxDecodeQueueSize**: Maximum chunks in the decoder's internal queue before pausing upstream

### Backpressure Handling

VideoDecodeStream applies backpressure at two points:

1. **Decoder queue** - Pauses when `decoder.decodeQueueSize >= maxDecodeQueueSize`
2. **Output buffer** - Pauses when downstream is full (`controller.desiredSize < 0`)

This prevents memory issues from decoding faster than downstream can process.

### Example

```typescript
import { VideoDecodeStream } from 'webcodecs-utils';

const decoderConfig = {
  codec: 'avc1.42001f',
  codedWidth: 1920,
  codedHeight: 1080,
};

const decodeStream = new VideoDecodeStream(decoderConfig, {
  highWaterMark: 15,      // Buffer up to 15 frames
  maxDecodeQueueSize: 30  // Allow 30 chunks in decode queue
});

// Use in pipeline
await chunkStream
  .pipeThrough(decodeStream)
  .pipeThrough(processStream)
  // ...
```

### Error Handling

Decoder errors are caught and propagate through the stream, terminating the pipeline:

```typescript
try {
  await chunkStream.pipeThrough(decodeStream).pipeTo(sink);
} catch (error) {
  console.error('Decode error:', error);
}
```

---

## VideoEncodeStream

Encodes `VideoFrame` objects into `EncodedVideoChunk` objects using the WebCodecs VideoEncoder API.

### API

```typescript
class VideoEncodeStream extends TransformStream<
  VideoFrame,
  { chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }
> {
  constructor(
    config: VideoEncoderConfig,
    options?: {
      highWaterMark?: number;        // default: 10 chunks
      maxEncodeQueueSize?: number;   // default: 20 frames
      keyFrameInterval?: number;     // default: 60 frames
    }
  )
}
```

### Parameters

- **config**: VideoEncoderConfig object (codec, width, height, bitrate, etc.)
- **options.highWaterMark**: Maximum chunks buffered in the output stream
- **options.maxEncodeQueueSize**: Maximum frames in the encoder's internal queue
- **options.keyFrameInterval**: Insert keyframe every N frames (default: 60)

### Output Format

VideoEncodeStream outputs objects containing both the chunk and metadata:

```typescript
{
  chunk: EncodedVideoChunk,
  meta?: EncodedVideoChunkMetadata  // Contains decoderConfig on first chunk
}
```

The metadata is important for muxers that need to write codec configuration.

### Backpressure Handling

Similar to VideoDecodeStream:

1. **Encoder queue** - Pauses when `encoder.encodeQueueSize >= maxEncodeQueueSize`
2. **Output buffer** - Pauses when downstream is full

### Frame Management

VideoEncodeStream automatically closes input frames after encoding to free memory:

```typescript
encoder.encode(frame, { keyFrame });
frame.close();  // Automatically called
```

### Example

```typescript
import { VideoEncodeStream, getBitrate, getCodecString } from 'webcodecs-utils';

const width = 1920;
const height = 1080;
const bitrate = getBitrate(width, height, 30, 'high');

const encoderConfig = {
  codec: getCodecString('avc', width, height, bitrate),
  width,
  height,
  bitrate: Math.round(bitrate),
  framerate: 30,
};

const encodeStream = new VideoEncodeStream(encoderConfig, {
  keyFrameInterval: 120  // Keyframe every 4 seconds at 30fps
});

await frameStream
  .pipeThrough(encodeStream)
  .pipeTo(muxerSink);
```

---

## VideoProcessStream

Applies a custom processing function to each `VideoFrame`. This is where you implement filters, upscaling, color grading, etc.

### API

```typescript
class VideoProcessStream extends TransformStream<VideoFrame, VideoFrame> {
  constructor(
    transformFn: (frame: VideoFrame) => Promise<VideoFrame> | VideoFrame,
    options?: {
      highWaterMark?: number;  // default: 5 frames
    }
  )
}
```

### Parameters

- **transformFn**: Async or sync function that processes each frame
- **options.highWaterMark**: Maximum frames buffered (kept small since frames are large)

### Transform Function

The transform function receives a `VideoFrame` and must return a `VideoFrame` (can be the same frame or a new one):

```typescript
async (frame: VideoFrame) => {
  // Option 1: Modify and return the same frame
  // (Only works if you're not changing dimensions/format)
  return frame;

  // Option 2: Create a new frame from processed data
  const processedFrame = new VideoFrame(canvas, {
    timestamp: frame.timestamp,
    duration: frame.duration
  });
  return processedFrame;
}
```

### Frame Ownership

VideoProcessStream handles frame cleanup automatically:
- If you return a **different** frame, the original is closed
- If you return the **same** frame, it's not closed (passed downstream)

### Example: Passthrough

```typescript
const passthroughStream = new VideoProcessStream((frame) => frame);
```

### Example: AI Upscaling with WebSR

```typescript
import WebSR from '@websr/websr';

const gpu = await WebSR.initWebGPU();
const canvas = document.createElement('canvas');
canvas.width = 640;
canvas.height = 360;

const websr = new WebSR({
  resolution: { width: 320, height: 180 },
  network_name: "anime4k/cnn-2x-l",
  weights: await (await fetch(weightsUrl)).json(),
  gpu,
  canvas
});

const upscaleStream = new VideoProcessStream(async (frame) => {
  // Render upscaled frame to canvas using WebGPU
  await websr.render(frame);

  // Create new frame from canvas
  const upscaledFrame = new VideoFrame(canvas, {
    timestamp: frame.timestamp,
    duration: frame.duration,
  });

  return upscaledFrame;
});
```

### Example: Canvas-based Processing

```typescript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const grayscaleStream = new VideoProcessStream(async (frame) => {
  canvas.width = frame.displayWidth;
  canvas.height = frame.displayHeight;

  // Draw frame to canvas
  ctx.drawImage(frame, 0, 0);

  // Apply grayscale filter
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const avg = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
    imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = avg;
  }
  ctx.putImageData(imageData, 0, 0);

  // Create new frame
  const processedFrame = new VideoFrame(canvas, {
    timestamp: frame.timestamp,
    duration: frame.duration
  });

  return processedFrame;
});
```

### Error Handling

If the transform function throws, the error propagates and the original frame is closed:

```typescript
const stream = new VideoProcessStream(async (frame) => {
  try {
    // Your processing here
    return processedFrame;
  } catch (error) {
    console.error('Processing error:', error);
    throw error;  // Will close frame and terminate pipeline
  }
});
```

---

## Complete Pipeline Example

Here's a full transcoding pipeline with AI upscaling:

```typescript
import {
  SimpleDemuxer,
  VideoDecodeStream,
  VideoProcessStream,
  VideoEncodeStream,
  SimpleMuxer,
  getBitrate,
  getCodecString
} from 'webcodecs-utils';

import WebSR from '@websr/websr';

async function upscaleVideo(file: File): Promise<Blob> {
  // Initialize WebSR
  const gpu = await WebSR.initWebGPU();
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;

  const websr = new WebSR({
    resolution: { width: 320, height: 180 },
    network_name: "anime4k/cnn-2x-l",
    weights: await (await fetch(weightsUrl)).json(),
    gpu,
    canvas
  });

  // Set up demuxer
  const demuxer = new SimpleDemuxer(file);
  await demuxer.load();
  const decoderConfig = await demuxer.getVideoDecoderConfig();

  // Set up encoder for 2x resolution
  const width = 640;
  const height = 360;
  const bitrate = getBitrate(width, height, 30, 'high');

  const encoderConfig = {
    codec: getCodecString('avc', width, height, bitrate),
    width,
    height,
    bitrate: Math.round(bitrate),
    framerate: 30,
  };

  // Set up muxer
  const muxer = new SimpleMuxer({ video: 'avc' });

  // Build the pipeline
  await demuxer.videoStream()
    .pipeThrough(new VideoDecodeStream(decoderConfig))
    .pipeThrough(new VideoProcessStream(async (frame) => {
      await websr.render(frame);
      return new VideoFrame(canvas, {
        timestamp: frame.timestamp,
        duration: frame.duration
      });
    }))
    .pipeThrough(new VideoEncodeStream(encoderConfig))
    .pipeTo(muxer.videoSink());

  return await muxer.finalize();
}
```

---

## Performance Considerations

### Buffer Sizes (highWaterMark)

- **Decode**: 10-15 frames is usually sufficient
- **Encode**: 10-15 chunks works well
- **Process**: Keep small (5 frames) since frames are large in memory

Larger buffers can improve throughput but increase memory usage.

### Queue Sizes

- **maxDecodeQueueSize**: 20-30 allows decoder to work ahead slightly
- **maxEncodeQueueSize**: 20-30 allows encoder to work ahead slightly

Too small causes stuttering; too large wastes memory.

### Processing Performance

For VideoProcessStream:
- WebGPU operations (like WebSR) are fastest
- Canvas2D operations are slower but widely supported
- Keep operations per-frame under ~16ms for real-time (30fps)

### Memory Management

The Streams API automatically manages memory through backpressure, but:
- Always close frames you create: `frame.close()`
- VideoProcessStream handles this for you
- Don't hold references to frames outside the transform function

---

## Browser Support

- **Streams API**: Chrome 52+, Firefox 65+, Safari 14.1+
- **WebCodecs API**: Chrome 94+, Edge 94+, Safari 17.4+ (limited)
- **WebGPU** (for WebSR): Chrome 113+, Edge 113+, Safari 18+

All streaming utilities include proper error handling for unsupported features.

---

## Demos

- [Transcode Pipeline](../../demos/transcode-pipeline.html) - Basic transcoding with passthrough
- [AI Upscaling Pipeline](../../demos/upscale-pipeline.html) - Real-time 2x upscaling with WebSR

---

## Related

- [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [WebCodecs Fundamentals](https://webcodecsfundamentals.org) - Comprehensive guide
- [MediaBunny](https://mediabunny.dev/) - Full-featured WebCodecs library
