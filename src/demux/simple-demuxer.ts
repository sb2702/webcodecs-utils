import { WebDemuxer } from "web-demuxer";

/**
 * Simple wrapper around web-demuxer for easier usage
 * Provides streaming and batch access to encoded chunks
 */
export class SimpleDemuxer {
  private demuxer: WebDemuxer;
  private file: File;
  private loaded = false;

  constructor(file: File, options?: { wasmFilePath?: string }) {
    this.file = file;
    this.demuxer = new WebDemuxer({
      wasmFilePath: options?.wasmFilePath ||
        "https://cdn.jsdelivr.net/npm/web-demuxer@latest/dist/wasm-files/web-demuxer.wasm",
    });
  }

  /**
   * Load and parse the media file
   */
  async load(): Promise<void> {
    await this.demuxer.load(this.file);
    this.loaded = true;
  }

  /**
   * Get a ReadableStream of video chunks from start time (default: 0)
   * @param startTime Start time in seconds (default: 0)
   */
  videoStream(startTime: number = 0): ReadableStream<EncodedVideoChunk> {
    if (!this.loaded) {
      throw new Error("SimpleDemuxer: Must call load() before accessing streams");
    }
    return this.demuxer.read('video', startTime) as ReadableStream<EncodedVideoChunk>;
  }

  /**
   * Get a ReadableStream of audio chunks from start time (default: 0)
   * @param startTime Start time in seconds (default: 0)
   */
  audioStream(startTime: number = 0): ReadableStream<EncodedAudioChunk> {
    if (!this.loaded) {
      throw new Error("SimpleDemuxer: Must call load() before accessing streams");
    }
    return this.demuxer.read('audio', startTime) as ReadableStream<EncodedAudioChunk>;
  }

  /**
   * Get video decoder configuration
   */
  async getVideoDecoderConfig(): Promise<VideoDecoderConfig> {
    if (!this.loaded) {
      throw new Error("SimpleDemuxer: Must call load() before getting config");
    }
    return await this.demuxer.getDecoderConfig('video');
  }

  /**
   * Get audio decoder configuration
   */
  async getAudioDecoderConfig(): Promise<AudioDecoderConfig> {
    if (!this.loaded) {
      throw new Error("SimpleDemuxer: Must call load() before getting config");
    }
    return await this.demuxer.getDecoderConfig('audio');
  }

  /**
   * Get a segment of encoded chunks as an array
   * @param type Track type ('video' or 'audio')
   * @param start Start time in seconds
   * @param end End time in seconds
   * @returns Array of encoded chunks
   */
  async getSegment(
    type: 'video' | 'audio',
    start: number,
    end: number
  ): Promise<EncodedVideoChunk[] | EncodedAudioChunk[]> {
    if (!this.loaded) {
      throw new Error("SimpleDemuxer: Must call load() before getting segments");
    }

    const stream = this.demuxer.read(type, start, end);
    const chunks: (EncodedVideoChunk | EncodedAudioChunk)[] = [];
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    return chunks;
  }

  /**
   * Get media information (tracks, duration, etc.)
   */
  async getMediaInfo() {
    if (!this.loaded) {
      throw new Error("SimpleDemuxer: Must call load() before getting media info");
    }
    return await this.demuxer.getMediaInfo();
  }
}
