/**
 * RAG utilities for PDF text processing and chunking
 */

export interface TextChunk {
  page: number;
  chunk_index: number;
  text: string;
  metadata: Record<string, any>;
}

/**
 * Hash function for generating stable source identifiers
 */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Normalize whitespace in text while preserving structure
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')  // Multiple spaces to single space
    .replace(/\n\s*\n/g, '\n')  // Multiple newlines to single newline
    .trim();
}

/**
 * Detect simple heading patterns for metadata
 */
export function detectSection(text: string): string | undefined {
  // Simple heuristics for heading detection
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return undefined;
  
  const firstLine = lines[0].trim();
  
  // Check for common heading patterns
  if (firstLine.length < 100 && (
    /^[A-Z][A-Z\s]{2,50}$/.test(firstLine) ||  // ALL CAPS headings
    /^\d+\.?\s+[A-Z]/.test(firstLine) ||       // Numbered sections
    /^[IVX]+\.?\s+[A-Z]/.test(firstLine)       // Roman numerals
  )) {
    return firstLine;
  }
  
  return undefined;
}

/**
 * Create chunks from page texts with overlap
 */
export function createChunks(
  pagesText: Array<{page: number, text: string}>,
  chunkSize: number = 1000,
  overlapPercent: number = 0.15
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const overlapSize = Math.floor(chunkSize * overlapPercent);
  
  for (const pageData of pagesText) {
    const { page, text } = pageData;
    const normalizedText = normalizeWhitespace(text);
    
    if (normalizedText.length === 0) continue;
    
    // If text is smaller than chunk size, use as single chunk
    if (normalizedText.length <= chunkSize) {
      chunks.push({
        page,
        chunk_index: chunks.length,
        text: normalizedText,
        metadata: {
          section: detectSection(normalizedText),
          char_count: normalizedText.length
        }
      });
      continue;
    }
    
    // Split into overlapping chunks
    let start = 0;
    let chunkIndex = 0;
    
    while (start < normalizedText.length) {
      let end = start + chunkSize;
      
      // If not at the end, try to break at word boundary
      if (end < normalizedText.length) {
        const nextSpace = normalizedText.lastIndexOf(' ', end);
        if (nextSpace > start + chunkSize * 0.8) {
          end = nextSpace;
        }
      }
      
      const chunkText = normalizedText.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({
          page,
          chunk_index: chunks.length,
          text: chunkText,
          metadata: {
            section: chunkIndex === 0 ? detectSection(chunkText) : undefined,
            char_count: chunkText.length,
            start_char: start,
            end_char: end
          }
        });
      }
      
      // Move start position with overlap
      start = Math.max(start + chunkSize - overlapSize, end);
      chunkIndex++;
    }
  }
  
  return chunks;
}

/**
 * Build ingestion payload for RAG system
 */
export function buildIngestPayload(
  fileName: string,
  sourceHash: string,
  chunks: TextChunk[]
): {
  title: string;
  source: string;
  kind: string;
  chunks: TextChunk[];
} {
  return {
    title: fileName,
    source: `pdf:${sourceHash}`,
    kind: 'pdf',
    chunks
  };
}