/**
 * Calculate optimal bitrate for video encoding based on resolution and quality.
 *
 * This function uses a simple heuristic formula: `pixels * fps * quality_factor`
 * The quality factors are calibrated for typical 30fps content.
 *
 * @param width - Video width in pixels
 * @param height - Video height in pixels
 * @param quality - Quality preset: 'low' (0.05), 'good' (0.08), 'high' (0.10), 'very-high' (0.15)
 * @returns Bitrate in bits per second (bps)
 *
 * @example
 * ```typescript
 * // 1080p at good quality
 * const bitrate = getBitrate(1920, 1080, 'good');
 * // Returns: ~4.9 Mbps
 *
 * encoder.configure({
 *   codec: 'avc1.42003e',
 *   width: 1920,
 *   height: 1080,
 *   bitrate
 * });
 * ```
 *
 * @example
 * ```typescript
 * // 4K at high quality
 * const bitrate = getBitrate(3840, 2160, 'high');
 * // Returns: ~24.8 Mbps
 * ```
 */
export function getBitrate(width: number, height: number, quality: 'low' | 'good' | 'high' | 'very-high' = 'good') {
    const pixels = width * height;
    const qualityFactors = {
      'low': 0.05,
      'good': 0.08,
      'high': 0.10,
      'very-high': 0.15
    };
    const factor = qualityFactors[quality as keyof typeof qualityFactors] || qualityFactors['good'];
    return pixels * 30 * factor; // 30fps
}