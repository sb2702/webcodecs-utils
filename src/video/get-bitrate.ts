/**
 * Calculate optimal bitrate for video encoding based on resolution, framerate, and quality.
 *
 * This function uses a simple heuristic formula: `pixels * fps * quality_factor`
 *
 * @param width - Video width in pixels
 * @param height - Video height in pixels
 * @param fps - Target framerate (default: 30)
 * @param quality - Quality preset: 'low' (0.05), 'good' (0.08), 'high' (0.10), 'very-high' (0.15)
 * @returns Bitrate in bits per second (bps)
 *
 * @example
 * ```typescript
 * // 1080p at 30fps, good quality
 * const bitrate = getBitrate(1920, 1080, 30, 'good');
 * // Returns: ~4.9 Mbps
 *
 * encoder.configure({
 *   codec: 'avc1.42003e',
 *   width: 1920,
 *   height: 1080,
 *   bitrate,
 *   framerate: 30
 * });
 * ```
 *
 * @example
 * ```typescript
 * // 4K at 60fps, high quality
 * const bitrate = getBitrate(3840, 2160, 60, 'high');
 * // Returns: ~49.7 Mbps
 * ```
 */
export function getBitrate(width: number, height: number, fps: number = 30, quality: 'low' | 'good' | 'high' | 'very-high' = 'good') {
    const pixels = width * height;
    const qualityFactors = {
      'low': 0.05,
      'good': 0.08,
      'high': 0.10,
      'very-high': 0.15
    };
    const factor = qualityFactors[quality as keyof typeof qualityFactors] || qualityFactors['good'];
    return pixels * fps * factor;
}