import {
    EncodedPacket,
    EncodedVideoPacketSource,
    EncodedAudioPacketSource,
    BufferTarget,
    Mp4OutputFormat,
    Output
  } from 'mediabunny';

/**
 * Simple muxer for creating MP4 files from encoded video or audio chunks.
 *
 * This class wraps MediaBunny's muxing functionality to provide a simplified
 * API for demos and learning purposes. It handles a single video or audio track.
 *
 * **⚠️ Demo/Learning Only**: This utility is intended for demos and learning.
 * For production use, please use MediaBunny directly: https://mediabunny.dev/
 *
 * @example
 * ```typescript
 * // Create muxer for video
 * const muxer = new ExampleMuxer('video');
 *
 * // In VideoEncoder output callback:
 * encoder.configure({
 *   output: (chunk, metadata) => {
 *     muxer.addChunk(chunk, metadata);
 *   },
 *   error: (e) => console.error(e)
 * });
 *
 * // ... encode frames ...
 * await encoder.flush();
 *
 * // Get final MP4
 * const mp4Buffer = await muxer.finish();
 * const blob = new Blob([mp4Buffer], { type: 'video/mp4' });
 * ```
 *
 * @example
 * ```typescript
 * // Create muxer for audio
 * const muxer = new ExampleMuxer('audio');
 *
 * // In AudioEncoder output callback:
 * encoder.configure({
 *   output: (chunk) => {
 *     muxer.addChunk(chunk);
 *   },
 *   error: (e) => console.error(e)
 * });
 * ```
 */
export class ExampleMuxer{

    type: 'audio' | 'video'
    output: Output
    source: EncodedVideoPacketSource | EncodedAudioPacketSource
    started: boolean;
    target: BufferTarget

    /**
     * Create a new ExampleMuxer.
     *
     * @param type - Track type: 'video' (default) or 'audio'
     */
    constructor(type?: 'audio'|'video'){
        this.type = type || 'video';

        this.target = new BufferTarget();

        const output = new Output({
            format: new Mp4OutputFormat(),
            target: this.target,
        });

        this.started  = false;

        this.output = output;
        
        this.source = this.type=== 'video'?  new EncodedVideoPacketSource('avc') : new EncodedAudioPacketSource('aac');
        this.output.addVideoTrack(this.source);

        
        console.warn(
            '⚠️  Demo/Learning Function: This utility is intended for demos and learning purposes only. ' +
            'For production use, please use a proper muxing library like MediaBunny (https://mediabunny.dev/) '
          );

    }

    /**
     * Add an encoded chunk to the MP4 file.
     *
     * @param chunk - EncodedVideoChunk or EncodedAudioChunk from encoder output
     * @param meta - Optional metadata from encoder (for video, contains decoderConfig)
     */
    addChunk(chunk: EncodedAudioChunk | EncodedVideoChunk, meta?: any){

        if(!this.started){
            this.output.start();
            this.started = true;
        }
        this.source.add(EncodedPacket.fromEncodedChunk(chunk), meta)
    }

    /**
     * Finalize the MP4 file and return the complete buffer.
     *
     * Call this after all chunks have been added.
     *
     * @returns Complete MP4 file as ArrayBuffer
     */
    async finish(): Promise<ArrayBuffer>{
        await this.output.finalize();

        return <ArrayBuffer> this.target.buffer;


    }





}