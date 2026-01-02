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