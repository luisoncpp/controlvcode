import type { Range } from '../types';
import { advanceIndexPastProtectedRanges, skipWhitespace } from './textUtils';

const CDATA_START = '<![CDATA[';
const CDATA_END = ']]>';

export function tryExtractCDataContent(
  text: string,
  /*start=*/start: number,
  closeTag: string,
): { content: string; endIndex: number } | null {
  const innerStart = start + CDATA_START.length;
  const innerEnd = text.indexOf(CDATA_END, innerStart);
  if (innerEnd === -1) return null;

  const cdataContent = text.substring(innerStart, innerEnd);

  let afterCData = innerEnd + CDATA_END.length;
  while (afterCData < text.length && /\s/.test(text[afterCData])) afterCData++;

  if (text.substring(afterCData, afterCData + closeTag.length) === closeTag) {
    return { content: cdataContent, endIndex: afterCData + closeTag.length };
  }
  return null;
}

interface ExtractStandardContentParams {
  text: string;
  start: number;
  tagName: string;
  protectedRanges: Range[];
}

export function tryExtractStandardContent({
  text,
  start,
  tagName,
  protectedRanges,
}: ExtractStandardContentParams): { content: string; endIndex: number } | null {
  const closeTag = `</${tagName}>`;
  const openTagPrefix = `<${tagName}`;
  let i = start;
  let depth = 1;

  while (i < text.length && depth > 0) {
    i = advanceIndexPastProtectedRanges(i, protectedRanges);
    if (i >= text.length) break;

    if (text.substring(i, i + closeTag.length) === closeTag) {
      depth--;
      if (depth === 0) return { content: text.substring(start, i), endIndex: i + closeTag.length };
      i += closeTag.length;
      continue;
    }

    if (text.substring(i, i + openTagPrefix.length) === openTagPrefix) {
      const afterPrefix = text.substring(i + openTagPrefix.length);
      if (afterPrefix.length > 0 && (afterPrefix[0] === ' ' || afterPrefix[0] === '>' || afterPrefix[0] === '/' || afterPrefix[0] === '\t' || afterPrefix[0] === '\n' || afterPrefix[0] === '\r')) {
        depth++;
        i += openTagPrefix.length;
        continue;
      }
    }

    i++;
  }

  return null;
}

interface ExtractContentParams {
  text: string;
  start: number;
  tagName: string;
  protectedRanges: Range[];
}

export function extractContent({
  text,
  start,
  tagName,
  protectedRanges,
}: ExtractContentParams): { content: string | null; endIndex: number; isCData?: boolean } {
  const contentStart = skipWhitespace(text, start);

  if (text.substring(contentStart, contentStart + CDATA_START.length) === CDATA_START) {
    const result = tryExtractCDataContent(text, /*start=*/contentStart, `</${tagName}>`);
    return result
      ? { content: result.content, endIndex: result.endIndex, isCData: true }
      : { content: null, endIndex: start };
  }

  const result = tryExtractStandardContent({ text, start: contentStart, tagName, protectedRanges });
  return result
    ? { content: result.content, endIndex: result.endIndex, isCData: false }
    : { content: null, endIndex: start };
}
