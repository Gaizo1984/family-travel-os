import sharp from 'sharp'

/**
 * Deterministische, KI-freie Bild-Dublettenerkennung (Leitlinie "KI nur bei
 * echtem Mehrwert"): dHash (Difference Hash) auf ein 9x8-Graustufenbild —
 * vergleicht jedes Pixel mit seinem rechten Nachbarn, ergibt 64 Bit als
 * Hex-String. Kleiner Hamming-Abstand = visuell sehr ähnliches/identisches
 * Foto, unabhängig von Auflösung/Kompression.
 */
export async function computeDHash(buffer: Buffer): Promise<string | null> {
  try {
    const { data } = await sharp(buffer)
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true })

    let bits = ''
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col]
        const right = data[row * 9 + col + 1]
        bits += left > right ? '1' : '0'
      }
    }
    return BigInt('0b' + bits).toString(16).padStart(16, '0')
  } catch {
    return null
  }
}

export function hammingDistance(hashA: string, hashB: string): number {
  const zero = BigInt(0)
  const one = BigInt(1)
  const a = BigInt('0x' + hashA)
  const b = BigInt('0x' + hashB)
  let xor = a ^ b
  let distance = 0
  while (xor > zero) {
    distance += Number(xor & one)
    xor >>= one
  }
  return distance
}

/** Ab dieser Hamming-Distanz gelten zwei Fotos noch als Dubletten (von 64 möglichen Bits). */
export const DUPLICATE_HASH_THRESHOLD = 8
