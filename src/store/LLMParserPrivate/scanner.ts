import type { Range, RawTag } from './types';
import { getInlineBacktickRanges } from './backtickRanges';

// Helpers privados (no exportados) para reducir el cuerpo de scanTags

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
  let name = '';
  while (i < text.length && text[i] !== ' ' && text[i] !== '>' && text[i] !== '/') {
    name += text[i];
    i++;
  }
  return { name, nextIndex: i };
}

function parseAttributes(text: string, start: number): { attrs: Record<string, string>; nextIndex: number } {
  const attrs: Record<string, string> = {};
  let i = start;

  while (i < text.length && text[i] !== '>' && text[i] !== '/') {
    // Espacios en blanco
    while (i < text.length && text[i] === ' ') i++;
    if (text[i] === '>' || text[i] === '/') break;

    // Nombre del atributo
    let attrName = '';
    while (i < text.length && text[i] !== '=' && text[i] !== ' ' && text[i] !== '>' && text[i] !== '/') {
      attrName += text[i];
      i++;
    }
    if (attrName.length === 0) break;

    while (i < text.length && text[i] === ' ') i++;
    if (text[i] === '=') {
      i++;
      while (i < text.length && text[i] === ' ') i++;
      if (text[i] === '"' || text[i] === "'") {
        const q = text[i];
        i++;
        let val = '';
        while (i < text.length && text[i] !== q) {
          val += text[i];
          i++;
        }
        if (text[i] === q) i++;
        attrs[attrName] = val;
      }
    }
  }

  return { attrs, nextIndex: i };
}

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
    i++; // consumir '<'

    // Nombre
    const { name, nextIndex: nameEnd } = parseName(rawText, i);
    i = nameEnd;
    if (name.length === 0) continue;

    // Atributos
    const { attrs, nextIndex: attrEnd } = parseAttributes(rawText, i);
    i = attrEnd;

    // Self-closing?
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

    if (i < rawText.length && rawText[i] === '>') {
      i++;
      // Saltar espacios iniciales del contenido
      while (i < rawText.length && (rawText[i] === ' ' || rawText[i] === '\n' || rawText[i] === '\r' || rawText[i] === '\t')) {
        i++;
      }
      const contentStart = i;
      const openTag = `<${name}`;
      const closeTag = `</${name}>`;
      let depth = 1;

      while (i < rawText.length && depth > 0) {
        i = skipProtected(i, protectedRanges);
        if (i >= rawText.length) break;

        if (rawText.substring(i, i + closeTag.length) === closeTag) {
          depth--;
          if (depth === 0) {
            i += closeTag.length;
            break;
          }
          i += closeTag.length;
          continue;
        }

        if (rawText.substring(i, i + openTag.length) === openTag) {
          const rest = rawText.substring(i + openTag.length);
          if (rest.length > 0 && (rest[0] === ' ' || rest[0] === '>' || rest[0] === '/')) {
            depth++;
            i += openTag.length;
            continue;
          }
        }

        i++;
      }

      if (depth === 0) {
        const content = rawText.substring(contentStart, i - closeTag.length);
        tags.push({
          name: name.toLowerCase(),
          attributes: attrs,
          content,
          isSelfClosing: false,
          startIndex: tagStart,
          endIndex: i,
        });
      }
    }
  }

  return tags;
}
