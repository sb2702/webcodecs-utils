import {
  BufferTarget,
  Mp4OutputFormat,
  Output,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacket,
} from 'mediabunny';

/**
 * Simple wrapper around MediaBunny's Output for easier muxing
 * Provides WritableStream interface for use in pipelines
 *
 * @example
 * ```typescript
 * const muxer = new SimpleMuxer({ video: 'avc', audio: 'aac' });
 *
 * await videoStream
 *   .pipeThrough(new VideoDecodeStream(config))
 *   .pipeThrough(new VideoEncodeStream(config))
 *   .pipeTo(muxer.videoSink());
 *
 * const blob = await muxer.finalize();
 * ```
 */
export class SimpleMuxer {
  private output: Output;
  private videoSource?: EncodedVideoPacketSource;
  private audioSource?: EncodedAudioPacketSource;
  private started = false;

  constructor(config: {
    video?: 'avc' | 'hevc' | 'vp8' | 'vp9' | 'av1';
    audio?: 'aac' | 'opus' | 'mp3' | 'vorbis' | 'flac';
  }) {
    const target = new BufferTarget();
    this.output = new Output({
      format: new Mp4OutputFormat(),
      target,
    });

    if (config.video) {
      this.videoSource = new EncodedVideoPacketSource(config.video as any);
      this.output.addVideoTrack(this.videoSource);
    }

    if (config.audio) {
      this.audioSource = new EncodedAudioPacketSource(config.audio as any);
      this.output.addAudioTrack(this.audioSource);
    }
  }

  /**
   * Get a WritableStream for video chunks with metadata
   * Use with .pipeTo() in a pipeline
   */
  videoSink(): WritableStream<{ chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }> {
    if (!this.videoSource) {
      throw new Error('SimpleMuxer: No video track configured');
    }

    const videoSource = this.videoSource;
    const startOutput = async () => {
      if (!this.started) {
        await this.output.start();
        this.started = true;
      }
    };

    return new WritableStream({
      start: async () => {
        await startOutput();
      },
      write: (value) => {
        const packet = EncodedPacket.fromEncodedChunk(value.chunk);
        videoSource.add(packet, value.meta)
      },
      close: () => {
        console.log('Video sink closed');
      },
      abort: (reason) => {
        console.error('Video sink aborted:', reason);
      }
    });
  }

  /**
   * Get a WritableStream for audio chunks
   * Use with .pipeTo() in a pipeline
   */
  audioSink(): WritableStream<EncodedAudioChunk> {
    if (!this.audioSource) {
      throw new Error('SimpleMuxer: No audio track configured');
    }

    const audioSource = this.audioSource;
    const startOutput = async () => {
      if (!this.started) {
        await this.output.start();
        this.started = true;
      }
    };

    return new WritableStream({
      start: async () => {
        await startOutput();
      },
      write: (chunk) => {
        const packet = EncodedPacket.fromEncodedChunk(chunk);
        audioSource.add(packet);
      },
      close: () => {
        console.log('Audio sink closed');
      },
      abort: (reason) => {
        console.error('Audio sink aborted:', reason);
      }
    });
  }

  /**
   * Finalize the muxer and return the output as a Blob
   * Call this after all streams have finished writing
   */
  async finalize(): Promise<Blob> {
    await this.output.finalize();
    const buffer = (this.output.target as BufferTarget).buffer;
    if (!buffer) {
      throw new Error('SimpleMuxer: No data was written to the muxer');
    }
    return new Blob([buffer], { type: 'video/mp4' });
  }
}
