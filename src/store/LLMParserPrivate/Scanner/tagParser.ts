
import type { RawTag, Range } from '../types';
import { getInlineBacktickRanges } from '../backtickRanges';
import { advanceIndexPastProtectedRanges, parseTagNameAt } from './textUtils';
import { parseAttributesAt } from './attributeParser';
import { extractContent } from './contentExtractor';

// Movemos scanTags aquí para permitir la llamada recursiva desde parseOpenTagWithContent
// sin generar dependencias circulares.
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

    const parsed = tryParseTagAt({
      text: rawText,
      openingBracketIndex: index,
      protectedRanges,
    });
    if (parsed) {
      tags.push(parsed.tag);
      index = parsed.nextIndex;
    } else {
      index++; // avanzar para no quedar atrapado
    }
  }

  return tags;
}

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
        children: [],
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

  // Llamada recursiva para obtener los hijos a partir del contenido extraído
  // IMPORTANTE: Si el contenido es CDATA, es texto literal y NO se debe parsear
  const children = (content && !isCData) ? scanTags(content) : [];

  return {
    tag: {
      name: tagName.toLowerCase(),
      attributes: attrs,
      content,
      children,
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

export function tryParseTagAt({
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
