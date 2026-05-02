import type { Range, RawTag } from './types';
import { getInlineBacktickRanges } from './backtickRanges';

const CDATA_START = '<![CDATA[';
const CDATA_END = ']]>';

// ── low‑level helpers ────────────────────────────────────────────────────

/**
 * Si el índice actual está dentro de un rango protegido (bloque de backticks),
 * salta hasta el final de dicho rango para evitar escanear su interior.
 */
function advanceIndexPastProtectedRanges(index: number, ranges: Range[]): number {
  for (const r of ranges) {
    if (index >= r.start && index < r.end) return r.end;
  }
  return index;
}

/** Salta espacios en blanco a partir de `start` y retorna el nuevo índice. */
function skipWhitespace(text: string, start: number): number {
  let i = start;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) {
    i++;
  }
  return i;
}

/** Lee el nombre de la etiqueta XML comenzando en `start`. */
function parseTagNameAt(text: string, start: number): { name: string; nextIndex: number } {
  let i = start;
  while (i < text.length && text[i] !== ' ' && text[i] !== '>' && text[i] !== '/' && text[i] !== '\t' && text[i] !== '\n' && text[i] !== '\r') {
    i++;
  }
  return { name: text.substring(start, i), nextIndex: i };
}

// ── attribute parsing (desglosado) ───────────────────────────────────────

/** Lee el nombre de un atributo (hasta `=`, espacio, `>` o `/`). */
function parseAttributeName(text: string, start: number): { name: string; nextIndex: number } {
  let i = start;
  while (i < text.length && text[i] !== '=' && text[i] !== ' ' && text[i] !== '>' && text[i] !== '/' && text[i] !== '\t' && text[i] !== '\n' && text[i] !== '\r') {
    i++;
  }
  return { name: text.substring(start, i), nextIndex: i };
}

/** Consume el signo `=` y los espacios opcionales alrededor. Retorna el índice donde comienza el valor. */
function consumeEqualsAndSpaces(text: string, start: number): number | null {
  let i = skipWhitespace(text, start);
  if (i >= text.length || text[i] !== '=') return null;
  i++;
  return skipWhitespace(text, i);
}

/** Lee un valor de atributo entre comillas (simple o doble). */
function parseQuotedAttributeValue(
  text: string,
  quoteIndex: number,
): { value: string; nextIndex: number } | null {
  const quoteChar = text[quoteIndex];
  if (quoteChar !== '"' && quoteChar !== "'") return null;

  const valStart = quoteIndex + 1;
  let i = valStart;
  while (i < text.length && text[i] !== quoteChar) i++;
  if (i >= text.length) return null; // unterminated string

  return { value: text.substring(valStart, i), nextIndex: i + 1 };
}

/** Parsea los atributos XML a partir de `start`. */
function parseAttributesAt(text: string, start: number): { attrs: Record<string, string>; nextIndex: number } {
  const attrs: Record<string, string> = {};
  let i = start;

  while (i < text.length && text[i] !== '>' && text[i] !== '/') {
    i = skipWhitespace(text, i);
    if (i >= text.length || text[i] === '>' || text[i] === '/') break;

    // nombre del atributo
    const { name: attrName, nextIndex: afterName } = parseAttributeName(text, i);
    i = afterName;
    if (attrName.length === 0) break;

    // '=' y valor
    const valueStart = consumeEqualsAndSpaces(text, i);
    if (valueStart === null) {
      // atributo sin valor, simplemente continuamos
      continue;
    }
    const valueResult = parseQuotedAttributeValue(text, valueStart);
    if (valueResult) {
      attrs[attrName] = valueResult.value;
      i = valueResult.nextIndex;
    } else {
      // no se pudo leer valor, seguir adelante
      i = valueStart;
    }
  }

  return { attrs, nextIndex: i };
}

// ── content extraction (CDATA / nesting) ─────────────────────────────────

function tryExtractCDataContent(
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

function tryExtractStandardContent({
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

function extractContent({
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

// ── tag parsing for a single '<' position ────────────────────────────────

interface ParseSelfClosingTagParams {
  text: string;
  tagStart: number;
  tagName: string;
  attrs: Record<string, string>;
  /** Índice que apunta al carácter '/' de la etiqueta. */
  slashIndex: number;
}

function parseSelfClosingTag({
  text,
  tagStart,
  tagName,
  attrs,
  slashIndex,
}: ParseSelfClosingTagParams): { tag: RawTag; nextIndex: number } | null {
  if (slashIndex >= text.length || text[slashIndex] !== '/') return null;
  let i = slashIndex + 1;
  if (i < text.length && text[i] === '>') {
    i++;
    return {
      tag: {
        name: tagName.toLowerCase(),
        attributes: attrs,
        content: null,
        isSelfClosing: true,
        startIndex: tagStart,
        endIndex: i,
      },
      nextIndex: i,
    };
  }
  return null;
}

interface ParseOpenTagWithContentParams {
  text: string;
  tagStart: number;
  tagName: string;
  attrs: Record<string, string>;
  /** Índice del primer carácter después del '>' de apertura. */
  contentStartIndex: number;
  protectedRanges: Range[];
}

function parseOpenTagWithContent({
  text,
  tagStart,
  tagName,
  attrs,
  contentStartIndex,
  protectedRanges,
}: ParseOpenTagWithContentParams): { tag: RawTag; nextIndex: number } | null {
  const { content, endIndex, isCData } = extractContent({
    text,
    start: contentStartIndex,
    tagName,
    protectedRanges,
  });
  if (content === null) return null;

  return {
    tag: {
      name: tagName.toLowerCase(),
      attributes: attrs,
      content,
      isSelfClosing: false,
      isCData,
      startIndex: tagStart,
      endIndex,
    },
    nextIndex: endIndex,
  };
}

interface TryParseTagAtParams {
  text: string;
  /** Índice del carácter '<' que abre la posible etiqueta. */
  openingBracketIndex: number;
  protectedRanges: Range[];
}

function tryParseTagAt({
  text,
  openingBracketIndex,
  protectedRanges,
}: TryParseTagAtParams): { tag: RawTag; nextIndex: number } | null {
  const tagStart = openingBracketIndex;
  let currentIndex = openingBracketIndex + 1; // después del '<'

  // Nombre de la etiqueta
  const { name: tagName, nextIndex: nameEnd } = parseTagNameAt(text, currentIndex);
  currentIndex = nameEnd;
  if (tagName.length === 0) return null;

  // Atributos
  const { attrs, nextIndex: attrEnd } = parseAttributesAt(text, currentIndex);
  currentIndex = attrEnd;

  // Decidir tipo de cierre
  if (currentIndex < text.length && text[currentIndex] === '/') {
    return parseSelfClosingTag({ text, tagStart, tagName, attrs, slashIndex: currentIndex });
  }
  if (currentIndex < text.length && text[currentIndex] === '>') {
    return parseOpenTagWithContent({
      text,
      tagStart,
      tagName,
      attrs,
      contentStartIndex: currentIndex + 1,
      protectedRanges,
    });
  }

  return null;
}

// ── escáner principal ────────────────────────────────────────────────────

export function scanTags(rawText: string): RawTag[] {
  const protectedRanges = getInlineBacktickRanges(rawText);
  const tags: RawTag[] = [];
  let index = 0;

  while (index < rawText.length) {
    index = advanceIndexPastProtectedRanges(index, protectedRanges);
    if (index >= rawText.length) break;

    if (rawText[index] !== '<') {
      index++;
      continue;
    }

    const parsed = tryParseTagAt({ text: rawText, openingBracketIndex: index, protectedRanges });
    if (parsed) {
      tags.push(parsed.tag);
      index = parsed.nextIndex;
    } else {
      index++; // avanzar para no quedar atrapado
    }
  }

  return tags;
}
