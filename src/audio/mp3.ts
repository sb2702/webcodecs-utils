// @ts-ignore - lamejs has no TypeScript types
import lamejs from 'lamejs';

// @ts-ignore - lamejs internal modules have no types
import MPEGMode from 'lamejs/src/js/MPEGMode';
// @ts-ignore
import Lame from 'lamejs/src/js/Lame';
// @ts-ignore
import BitStream from 'lamejs/src/js/BitStream';

// @ts-ignore - mpg123-decoder has no types
import { MPEGDecoderWebWorker } from 'mpg123-decoder';
import { extractChannels } from './extract-channels';

// LameJS needs these to be global
(globalThis as any).MPEGMode = MPEGMode;
(globalThis as any).Lame = Lame;
(globalThis as any).BitStream = BitStream;

interface MP3EncoderConfig {
    sampleRate: number;
    bitRate: number;
    channels: number;
}

/**
 * Encode audio to MP3 format using LameJS.
 *
 * This encoder converts AudioData objects to MP3 format. It handles both
 * planar (f32-planar) and interleaved (f32) audio formats automatically.
 *
 * @example
 * ```typescript
 * // Create encoder
 * const encoder = new MP3Encoder({
 *   sampleRate: 48000,
 *   bitRate: 192,  // 192 kbps
 *   channels: 2    // Stereo
 * });
 *
 * // Encode AudioData objects
 * for (const audioData of audioDataArray) {
 *   const mp3Chunk = encoder.processBatch(audioData);
 *   encoder.encodedData.push(mp3Chunk);
 * }
 *
 * // Get final MP3 file
 * const mp3Blob = encoder.finish();
 * ```
 *
 * @remarks
 * This encoder uses LameJS for encoding. For production use, consider using
 * the native AudioEncoder API with opus codec, or a server-side encoder.
 */
class MP3Encoder {
    private mp3encoder: any;
    private config: MP3EncoderConfig;
    encodedData: Uint8Array[];

    /**
     * Create a new MP3Encoder.
     *
     * @param config - Encoder configuration
     * @param config.sampleRate - Audio sample rate in Hz (e.g., 48000)
     * @param config.bitRate - MP3 bitrate in kbps (e.g., 192)
     * @param config.channels - Number of audio channels (1 = mono, 2 = stereo)
     */
    constructor(config: MP3EncoderConfig) {
        this.config = config;


        this.mp3encoder = new lamejs.Mp3Encoder(
            config.channels,
            config.sampleRate,
            config.bitRate
        );
        this.encodedData = [];
    }

    // Convert AudioData to interleaved Int16 samples
    private convertAudioDataToInt16(audioData: AudioData): Int16Array {
        const numChannels = audioData.numberOfChannels;
        const numFrames = audioData.numberOfFrames;
        
        const planarData: Float32Array[] = extractChannels(audioData);

        // Convert to interleaved Int16 format
        const interleavedInt16 = new Int16Array(numFrames * numChannels);
        for (let i = 0; i < numFrames; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
                const sample = Math.max(-1, Math.min(1, planarData[channel][i]));
                interleavedInt16[i * numChannels + channel] = sample * 32767;
            }
        }

        return interleavedInt16;
    }

    /**
     * Encode a single AudioData object to MP3.
     *
     * @param audioData - The AudioData object to encode
     * @returns Encoded MP3 data as Uint8Array (add this to encodedData array)
     */
    processBatch(audioData: AudioData): Uint8Array {
        const samples = this.convertAudioDataToInt16(audioData);
        
            let mp3buf: Uint8Array;
            
            // Split samples into left and right channels if stereo
            if (this.config.channels === 2) {
                const left = new Int16Array(samples.length / 2);
                const right = new Int16Array(samples.length / 2);
                
                for (let i = 0; i < samples.length / 2; i++) {
                    left[i] = samples[i * 2];
                    right[i] = samples[i * 2 + 1];
                }
                
                mp3buf = this.mp3encoder.encodeBuffer(left, right);
            } else {
                // Mono
                mp3buf = this.mp3encoder.encodeBuffer(samples);
            }

        return mp3buf;
    }

    /**
     * Finalize encoding and get the complete MP3 file as a Blob.
     *
     * This method flushes any remaining data and combines all encoded chunks
     * into a single MP3 file blob.
     *
     * @returns Complete MP3 file as a Blob
     */
    finish(): Blob {
        const finalMp3buf = this.mp3encoder.flush();
        if (finalMp3buf.length > 0) {
            this.encodedData.push(finalMp3buf);
        }

        // Combine all encoded data
        const totalLength = this.encodedData.reduce((acc, arr) => acc + arr.length, 0);
        const combinedData = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const data of this.encodedData) {
            combinedData.set(data, offset);
            offset += data.length;
        }
        
        // Clear the buffer after combining
        this.encodedData = [];
        
        return new Blob([combinedData], { type: 'audio/mp3' });
    }

    // Optional: Get current size of encoded data
    getEncodedSize(): number {
        return this.encodedData.reduce((acc, arr) => acc + arr.length, 0);
    }
}

export interface MP3DecoderOutput {
    channels: Float32Array[],
    sampleRate: number,
    numberOfChannels: number
}

/**
 * Decode MP3 files to raw PCM samples or AudioData objects.
 *
 * This decoder uses mpg123-decoder (WebAssembly) to decode MP3 files.
 * It can output either raw Float32Array samples or AudioData objects
 * ready for use with WebCodecs APIs.
 *
 * @example
 * ```typescript
 * // Decode to raw samples
 * const decoder = new MP3Decoder();
 * await decoder.initialize();
 *
 * const mp3Buffer = await file.arrayBuffer();
 * const { channels, sampleRate, numberOfChannels } = await decoder.toSamples(mp3Buffer);
 *
 * // channels[0] = left channel (Float32Array)
 * // channels[1] = right channel (Float32Array) if stereo
 * ```
 *
 * @example
 * ```typescript
 * // Decode to AudioData objects
 * const decoder = new MP3Decoder();
 * await decoder.initialize();
 *
 * const mp3Buffer = await file.arrayBuffer();
 * const audioDataArray = await decoder.toAudioData(mp3Buffer);
 *
 * // Use with AudioEncoder or other WebCodecs APIs
 * for (const audioData of audioDataArray) {
 *   encoder.encode(audioData);
 *   audioData.close();
 * }
 *
 * await decoder.destroy();
 * ```
 */
class MP3Decoder {
    private decoder: any;
    private isReady: boolean = false;

    /**
     * Create a new MP3Decoder.
     *
     * The decoder auto-detects sample rate and channel configuration from the MP3 file.
     * Call initialize() before using.
     */
    constructor() {
        // mpg123-decoder will auto-detect sample rate and config from the MP3 file
    }

    /**
     * Initialize the decoder (async)
     */
    async initialize(): Promise<void> {
        if (this.isReady) return;

        try {
            this.decoder = new MPEGDecoderWebWorker();
            await this.decoder.ready;
            this.isReady = true;
        } catch (error) {
            console.error('Failed to initialize MP3 decoder:', error);
            throw error;
        }
    }

    /**
     * Decode MP3 buffer to raw PCM samples
     * @param mp3Buffer - The MP3 data as ArrayBuffer
     * @returns Promise<{channels: Float32Array[], sampleRate: number, numberOfChannels: number}>
     */
    async toSamples(mp3Buffer: ArrayBuffer): Promise<{
        channels: Float32Array[], 
        sampleRate: number, 
        numberOfChannels: number
    }> {
        if (!this.isReady) {
            await this.initialize();
        }

        try {
            // Decode the MP3 data
            const result = await this.decoder.decode(new Uint8Array(mp3Buffer));
            
            const { channelData, sampleRate } = result;
            const numberOfChannels = channelData.length;
            
            // Convert to Float32Array channels
            const channels: Float32Array[] = channelData.map((channel: Int16Array) => {
                // Convert Int16 to Float32 (-32768 to 32767 → -1 to 1)
                const float32Channel = new Float32Array(channel.length);
                for (let i = 0; i < channel.length; i++) {
                    float32Channel[i] = channel[i] 
                }
                return float32Channel;
            });
            

            return {
                channels,
                sampleRate,
                numberOfChannels
            };
        } catch (error) {
            console.error('Failed to decode MP3:', error);
            throw error;
        }
    }


    /**
     * Decode MP3 to AudioData objects.
     * Internally calls decodeMP3ToSamples and converts the Float32Array channels to AudioData.
     *
     * @param mp3Buffer - The MP3 data as ArrayBuffer
     * @returns Promise<AudioData[]> - Array of AudioData objects
     *
     * @example
     * ```typescript
     * const decoder = new MP3Decoder();
     * await decoder.initialize();
     * const mp3Buffer = await file.arrayBuffer();
     * const audioDataArray = await decoder.decode(mp3Buffer);
     *
     * // Use with AudioEncoder or other WebCodecs APIs
     * for (const audioData of audioDataArray) {
     *   encoder.encode(audioData);
     *   audioData.close();
     * }
     * ```
     */
    async toAudioData(mp3Buffer: ArrayBuffer): Promise<AudioData[]> {
        // First decode to raw samples
        const { channels, sampleRate, numberOfChannels } = await this.toSamples(mp3Buffer);

        // Use fixed chunk size of 1024 samples per AudioData
        const samplesPerChunk = 1024;

        const totalSamples = channels[0].length;
        const audioDataArray: AudioData[] = [];

        console.log("Samples", totalSamples)

        // Split channels into AudioData chunks
        for (let offset = 0; offset < totalSamples; offset += samplesPerChunk) {
            const remainingSamples = totalSamples - offset;
            const chunkSize = Math.min(samplesPerChunk, remainingSamples);

            // Extract chunk from each channel
            const chunkChannels: Float32Array[] = channels.map(channel =>
                channel.slice(offset, offset + chunkSize)
            );

            // Interleave channels for AudioData
            const interleavedData = new Float32Array(chunkSize * numberOfChannels);
            for (let i = 0; i < chunkSize; i++) {
                for (let ch = 0; ch < numberOfChannels; ch++) {
                    interleavedData[i * numberOfChannels + ch] = chunkChannels[ch][i];
                }
            }

            // Create AudioData
            const timestamp = (offset / sampleRate) * 1e6; // microseconds
    

            const audioData = new AudioData({
                format: 'f32',
                sampleRate,
                numberOfFrames: chunkSize,
                numberOfChannels,
                timestamp: Math.round(timestamp),
                data: interleavedData
            });

            audioDataArray.push(audioData);
        }

        return audioDataArray;
    }

    /**
     * Clean up decoder resources
     */
    async destroy(): Promise<void> {
        if (this.decoder) {
            await this.decoder.free();
            this.decoder = null;
            this.isReady = false;
        }
    }
}

export { MP3Encoder, MP3Decoder };
