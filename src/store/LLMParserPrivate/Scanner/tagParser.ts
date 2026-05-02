import type { RawTag, Range } from '../types';
import { parseTagNameAt } from './textUtils';
import { parseAttributesAt } from './attributeParser';
import { extractContent } from './contentExtractor';

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
