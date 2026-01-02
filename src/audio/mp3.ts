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

class MP3Encoder {
    private mp3encoder: any;
    private config: MP3EncoderConfig;
    encodedData: Uint8Array[];

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

    // Process a single batch of AudioData objects
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

    // Finalize encoding and get all data as a Blob
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

class MP3Decoder {
    private decoder: any;
    private isReady: boolean = false;

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
    async decodeMP3ToSamples(mp3Buffer: ArrayBuffer): Promise<{
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
