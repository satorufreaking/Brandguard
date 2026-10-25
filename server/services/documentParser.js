import { createRequire } from 'module';
import mammoth from 'mammoth';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/octet-stream',
];

const MIME_TYPES_BY_EXTENSION = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
  '.txt': ['text/plain', 'application/octet-stream'],
  '.md': ['text/markdown', 'text/plain', 'application/octet-stream'],
};

/**
 * Extracts plain text from a PDF buffer.
 * Compatible with pdf-parse v2 (PDFParse class), v1 (callable function),
 * and raw stream fallback.
 */
async function extractPdfText(buffer) {
  // Strategy 1: pdf-parse v2 (Class-based: new PDFParse({ data: buffer }))
  const PDFParseClass = pdfParse?.PDFParse || (typeof pdfParse === 'function' ? null : pdfParse?.default?.PDFParse);
  if (PDFParseClass) {
    const parser = new PDFParseClass({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result?.text || '';
      if (text.trim()) return text;
    } finally {
      if (typeof parser.destroy === 'function') {
        try {
          await parser.destroy();
        } catch (_) {}
      }
    }
  }

  // Strategy 2: pdf-parse v1 (Function-based: pdfParse(buffer))
  if (typeof pdfParse === 'function') {
    const pdfData = await pdfParse(buffer);
    const text = pdfData?.text || '';
    if (text.trim()) return text;
  }

  // Strategy 3: default export function
  if (typeof pdfParse?.default === 'function') {
    const pdfData = await pdfParse.default(buffer);
    const text = pdfData?.text || '';
    if (text.trim()) return text;
  }

  // Strategy 4: Raw text stream extraction fallback (handles uncompressed PDF text blocks)
  const rawStr = buffer.toString('latin1');
  const textChunks = [];
  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let m;
  while ((m = tjRegex.exec(rawStr)) !== null) {
    textChunks.push(m[1]);
  }
  if (textChunks.length > 0) {
    return textChunks.join(' ');
  }

  return '';
}

/**
 * Extracts plain text from an uploaded buffer based on filename and mime type.
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} mimeType - MIME type
 * @returns {Promise<{ text: string, charCount: number, wordCount: number, filename: string }>}
 */
export async function parseDocumentBuffer(buffer, originalName = '', mimeType = '') {
  if (!buffer || buffer.length === 0) {
    throw new Error('The uploaded file is empty.');
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 10MB.`);
  }

  const ext = originalName ? originalName.slice(originalName.lastIndexOf('.')).toLowerCase() : '';

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported file format "${ext || 'unknown'}". Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}.`
    );
  }

  const normalizedMimeType = mimeType.toLowerCase().split(';')[0].trim();
  if (normalizedMimeType && !MIME_TYPES_BY_EXTENSION[ext].includes(normalizedMimeType)) {
    throw new Error(`File type "${normalizedMimeType}" does not match the "${ext}" extension.`);
  }
  if (ext === '.pdf' && !buffer.subarray(0, 1024).includes(Buffer.from('%PDF'))) {
    throw new Error('The uploaded file does not contain a valid PDF signature.');
  }
  if (ext === '.docx' && !(buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04)) {
    throw new Error('The uploaded file does not contain a valid DOCX archive.');
  }

  let extractedText = '';

  try {
    if (ext === '.pdf') {
      extractedText = await extractPdfText(buffer);
    } else if (ext === '.docx') {
      const docxResult = await mammoth.extractRawText({ buffer });
      extractedText = docxResult.value || '';
    } else if (ext === '.txt' || ext === '.md') {
      extractedText = buffer.toString('utf-8');
    } else {
      throw new Error(`Parser not configured for ${ext}`);
    }
  } catch (err) {
    throw new Error(`Failed to extract text from ${originalName}: ${err.message || 'File corrupted or password protected.'}`);
  }

  // Normalize line endings and whitespace
  const normalized = extractedText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (!normalized) {
    throw new Error('No readable text could be extracted from the document.');
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  return {
    text: normalized,
    charCount: normalized.length,
    wordCount: words.length,
    filename: originalName,
  };
}
