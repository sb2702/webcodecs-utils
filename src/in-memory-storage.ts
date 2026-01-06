/**
 * In-memory storage system that stores data in fixed-size chunks
 * and efficiently handles overlapping writes.
 */
export class InMemoryStorage {
    private chunks = new Map<number, Uint8Array>();
    private _chunkSize: number;
    private _size = 0;

    /**
     * Create a new InMemoryStorage instance
     * @param chunkSize Size of each chunk in bytes (default: 10MB)
     */
    constructor(chunkSize: number = 10 * 1024 * 1024) {
        this._chunkSize = chunkSize;
    }

    /**
     * Write data to storage, handling overlaps efficiently
     * @param data Data to write
     * @param position Position to write at
     */
    write(data: Uint8Array, position: number): void {
        // Update the total size
        this._size = Math.max(this._size, position + data.byteLength);
        
        // Calculate the starting and ending chunk indices
        const startChunkIndex = Math.floor(position / this._chunkSize);
        const endChunkIndex = Math.floor((position + data.byteLength - 1) / this._chunkSize);
        
        // For each affected chunk
        for (let chunkIndex = startChunkIndex; chunkIndex <= endChunkIndex; chunkIndex++) {
            // Calculate the chunk's boundaries
            const chunkStart = chunkIndex * this._chunkSize;
            const chunkEnd = chunkStart + this._chunkSize;
            
            // Calculate overlap between data and this chunk
            const overlapStart = Math.max(position, chunkStart);
            const overlapEnd = Math.min(position + data.byteLength, chunkEnd);
            const overlapSize = overlapEnd - overlapStart;
            
            // Skip if no actual overlap
            if (overlapSize <= 0) continue;
            
            // Create or get the chunk
            let chunk: Uint8Array;
            if (!this.chunks.has(chunkIndex)) {
                // Create a new chunk filled with zeros
                chunk = new Uint8Array(this._chunkSize);
                this.chunks.set(chunkIndex, chunk);
            } else {
                chunk = this.chunks.get(chunkIndex)!;
            }
            
            // Calculate offsets for copying
            const targetOffset = overlapStart - chunkStart;
            const sourceOffset = overlapStart - position;
            
            // Copy the data
            for (let i = 0; i < overlapSize; i++) {
                chunk[targetOffset + i] = data[sourceOffset + i];
            }
        }
    }

    /**
     * Get the total size of data written
     */
    get size(): number {
        return this._size;
    }

    /**
     * Convert all stored chunks to a single Blob
     * @param type MIME type for the Blob
     */
    toBlob(type: string = "application/octet-stream"): Blob {
        if (this.chunks.size === 0) {
            return new Blob([], { type });
        }

        // Get all chunk indices and sort them
        const chunkIndices = Array.from(this.chunks.keys()).sort((a, b) => a - b);
        
        // Create an array of chunks to use for the Blob
        const blobChunks: Uint8Array[] = [];
        
        for (let i = 0; i < chunkIndices.length; i++) {
            const chunkIndex = chunkIndices[i];
            const chunk = this.chunks.get(chunkIndex)!;
            
            // Handle the last chunk specially - it might need truncation
            if (i === chunkIndices.length - 1) {
                const remainingBytes = this._size - (chunkIndex * this._chunkSize);
                if (remainingBytes < this._chunkSize) {
                    // Truncate the last chunk to the correct size
                    blobChunks.push(chunk.slice(0, remainingBytes));
                } else {
                    blobChunks.push(chunk);
                }
            } else {
                blobChunks.push(chunk);
            }
        }
        
        return new Blob(blobChunks, { type });
    }
}
