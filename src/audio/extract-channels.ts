/**
 * Extract audio channels from AudioData as separate Float32Array buffers.
 *
 * AudioData can store samples in two formats:
 * - **Planar (f32-planar)**: Each channel is stored separately (most common)
 * - **Interleaved (f32)**: All channels are mixed together (L, R, L, R, L, R...)
 *
 * This function handles both formats automatically and returns an array of Float32Array,
 * where each array represents one channel (typically [left, right] for stereo).
 *
 * @param audioData - The AudioData object to extract channels from
 * @returns Array of Float32Array, one per channel (e.g., [leftChannel, rightChannel])
 *
 * @example
 * ```typescript
 * // Extract channels from decoded audio
 * const decoder = new AudioDecoder({
 *   output: (audioData) => {
 *     const channels = extractChannels(audioData);
 *     const leftChannel = channels[0];
 *     const rightChannel = channels[1]; // if stereo
 *
 *     // Process audio samples...
 *     for (let i = 0; i < leftChannel.length; i++) {
 *       leftChannel[i] *= 0.5; // Reduce volume by 50%
 *     }
 *   },
 *   error: (e) => console.error(e)
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Mix two audio sources
 * const source1Channels = extractChannels(audioData1);
 * const source2Channels = extractChannels(audioData2);
 *
 * const mixedLeft = new Float32Array(source1Channels[0].length);
 * for (let i = 0; i < mixedLeft.length; i++) {
 *   mixedLeft[i] = source1Channels[0][i] + source2Channels[0][i];
 * }
 * ```
 */
export function extractChannels(audioData: AudioData): Float32Array[] {
  const channels: Float32Array[] = [];

  if (audioData.format?.includes("planar")) {
    // Planar format: one plane per channel (f32-planar)
    // Most common format from AudioDecoder
    for (let i = 0; i < audioData.numberOfChannels; i++) {
      const channelData = new Float32Array(audioData.numberOfFrames);
      audioData.copyTo(channelData, { frameOffset: 0, planeIndex: i });
      channels.push(channelData);
    }
  } else {
    // Interleaved format: all channels in one buffer (f32)
    // Format: [L, R, L, R, L, R, ...] for stereo
    const interleavedData = new Float32Array(
      audioData.numberOfFrames * audioData.numberOfChannels
    );
    audioData.copyTo(interleavedData, { frameOffset: 0, planeIndex: 0 });

    // Deinterleave channels into separate arrays
    for (let ch = 0; ch < audioData.numberOfChannels; ch++) {
      const channelData = new Float32Array(audioData.numberOfFrames);
      for (let i = 0; i < audioData.numberOfFrames; i++) {
        channelData[i] = interleavedData[i * audioData.numberOfChannels + ch];
      }
      channels.push(channelData);
    }
  }

  return channels;
}