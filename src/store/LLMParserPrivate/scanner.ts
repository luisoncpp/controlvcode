import type { Range, RawTag } from './types';
import { getInlineBacktickRanges } from './backtickRanges';

const CDATA_START = '<![CDATA[';
const CDATA_END = ']]>';
const CDATA_END_PLACEHOLDER = '__CDATA_CLOSE__';

// --- Helpers (String slicing instead of concatenation) ---

function skipProtected(index: number, ranges: Range[]): number {
  for (const r of ranges) {
    if (index >= r.start && index < r.end) {
      return r.end;
    }
  }
  return index;
}

function parseName(text: string, start: number): { name: string; nextIndex: number } {
  let i = start;
  while (i < text.length && text[i] !== ' ' && text[i] !== '>' && text[i] !== '/') {
    i++;
  }
  return { name: text.substring(start, i), nextIndex: i };
}

function parseAttributes(text: string, start: number): { attrs: Record<string, string>; nextIndex: number } {
  const attrs: Record<string, string> = {};
  let i = start;

  while (i < text.length && text[i] !== '>' && text[i] !== '/') {
    while (i < text.length && text[i] === ' ') i++;
    if (text[i] === '>' || text[i] === '/') break;

    const attrStart = i;
    while (i < text.length && text[i] !== '=' && text[i] !== ' ' && text[i] !== '>' && text[i] !== '/') {
      i++;
    }
    const attrName = text.substring(attrStart, i);
    if (attrName.length === 0) break;

    while (i < text.length && text[i] === ' ') i++;
    
    if (text[i] === '=') {
      i++;
      while (i < text.length && text[i] === ' ') i++;
      
      if (text[i] === '"' || text[i] === "'") {
        const q = text[i];
        i++;
        const valStart = i;
        while (i < text.length && text[i] !== q) i++;
        attrs[attrName] = text.substring(valStart, i);
        if (text[i] === q) i++;
      }
    }
  }

  return { attrs, nextIndex: i };
}

// --- Content Extraction (Isolated depth tracking & CDATA support) ---

function extractContent(
  text: string, 
  start: number, 
  tagName: string, 
  protectedRanges: Range[]
): { content: string | null; endIndex: number; isCData?: boolean } {
  let i = start;

  // Skip initial whitespace
  while (i < text.length && /\s/.test(text[i])) i++;

  const closeTag = `</${tagName}>`;

  // 1. Handle CDATA sections verbatim
  if (text.substring(i, i + CDATA_START.length) === CDATA_START) {
    const innerStart = i + CDATA_START.length;
    const innerEnd = text.indexOf(CDATA_END, innerStart);
    
    if (innerEnd === -1) return { content: null, endIndex: start }; // Malformed
    
    let cdataContent = text.substring(innerStart, innerEnd);
    // Restore real CDATA closing sequence if the agent used the placeholder
    cdataContent = cdataContent.replaceAll(CDATA_END_PLACEHOLDER, CDATA_END);
    
    let cdataEnd = innerEnd + CDATA_END.length;
    
    // Skip trailing whitespace after ]]>
    while (cdataEnd < text.length && /\s/.test(text[cdataEnd])) cdataEnd++;
    
    // Expect and consume the closing tag
    if (text.substring(cdataEnd, cdataEnd + closeTag.length) === closeTag) {
      return { 
        content: cdataContent, 
        endIndex: cdataEnd + closeTag.length, 
        isCData: true 
      };
    }
    return { content: null, endIndex: start }; // Malformed
  }

  // 2. Handle standard nested XML content
  const openTag = `<${tagName}`;
  const contentStart = i;
  let depth = 1;

  while (i < text.length && depth > 0) {
    i = skipProtected(i, protectedRanges);
    if (i >= text.length) break;

    if (text.substring(i, i + closeTag.length) === closeTag) {
      depth--;
      if (depth === 0) {
        return { 
          content: text.substring(contentStart, i), 
          endIndex: i + closeTag.length 
        };
      }
      i += closeTag.length;
      continue;
    }

    if (text.substring(i, i + openTag.length) === openTag) {
      const rest = text.substring(i + openTag.length);
      if (rest.length > 0 && (rest[0] === ' ' || rest[0] === '>' || rest[0] === '/')) {
        depth++;
        i += openTag.length;
        continue;
      }
    }

    i++;
  }

  return { content: null, endIndex: start }; // Malformed (unclosed tag)
}

// --- Main Scanner ---

export function scanTags(rawText: string): RawTag[] {
  const protectedRanges = getInlineBacktickRanges(rawText);
  const tags: RawTag[] = [];
  let i = 0;

  while (i < rawText.length) {
    i = skipProtected(i, protectedRanges);
    if (i >= rawText.length) break;

    if (rawText[i] !== '<') {
      i++;
      continue;
    }

    const tagStart = i;
    i++; // consume '<'

    const { name, nextIndex: nameEnd } = parseName(rawText, i);
    i = nameEnd;
    if (name.length === 0) continue;

    const { attrs, nextIndex: attrEnd } = parseAttributes(rawText, i);
    i = attrEnd;

    // Self-closing tag
    if (i < rawText.length && rawText[i] === '/') {
      i++;
      if (i < rawText.length && rawText[i] === '>') {
        i++;
        tags.push({
          name: name.toLowerCase(),
          attributes: attrs,
          content: null,
          isSelfClosing: true,
          startIndex: tagStart,
          endIndex: i,
        });
      }
      continue;
    }

    // Open tag with content
    if (i < rawText.length && rawText[i] === '>') {
      i++; // consume '>'

      const { content, endIndex, isCData } = extractContent(rawText, i, name, protectedRanges);

      if (content !== null) {
        tags.push({
          name: name.toLowerCase(),
          attributes: attrs,
          content,
          isSelfClosing: false,
          isCData,
          startIndex: tagStart,
          endIndex,
        });
        i = endIndex; // Advance safely to the end of the parsed block
      }
      // If null (malformed), we just leave `i` right after '>' and keep scanning safely
    }
  }

  return tags;
}
