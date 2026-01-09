/**
 * Get the actual sample rate from an audio MediaStreamTrack.
 *
 * Firefox doesn't always expose sampleRate in track.getSettings(), so this
 * function creates a temporary AudioContext to determine the actual sample rate.
 *
 * @param track - The audio MediaStreamTrack to get the sample rate from
 * @returns The actual sample rate in Hz
 *
 * @example
 * ```typescript
 * const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
 * const audioTrack = stream.getAudioTracks()[0];
 * const sampleRate = await getSampleRate(audioTrack);
 * console.log(`Sample rate: ${sampleRate} Hz`);
 * ```
 */
export async function getSampleRate(track: MediaStreamTrack): Promise<number> {
  if (track.kind !== 'audio') {
    throw new Error('Track must be an audio track');
  }

  // Try to get sample rate from settings first (works in Chrome/Edge)
  const settings = track.getSettings();
  if (settings.sampleRate) {
    return settings.sampleRate;
  }

  // Fallback for Firefox: create a temporary AudioContext to get the actual sample rate
  const audioContext = new AudioContext();
  const source = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream: new MediaStream([track]),
  });

  const sampleRate = audioContext.sampleRate;

  // Cleanup
  source.disconnect();
  await audioContext.close();

  return sampleRate;
}
