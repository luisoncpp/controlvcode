import type { ActionNode } from '../types';

// ============================================================================
// Tipos internos
// ============================================================================

interface Range {
  start: number;
  end: number;
}

interface RawTag {
  name: string;
  attributes: Record<string, string>;
  content: string | null;
  isSelfClosing: boolean;
  startIndex: number;
  endIndex: number;
}

interface ExtractedNode {
  type: ActionNode['type'];
  payload: string;
  content?: string;
}

// ============================================================================
// Funciones puras
// ============================================================================

export function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

export function getInlineBacktickRanges(text: string): Range[] {
  const ranges: Range[] = [];
  let i = 0;

  while (i < text.length) {
    if (i + 2 < text.length && text[i] === '`' && text[i + 1] === '`' && text[i + 2] === '`') {
      i += 3;
      while (i + 2 < text.length) {
        if (text[i] === '`' && text[i + 1] === '`' && text[i + 2] === '`') {
          i += 3;
          break;
        }
        i++;
      }
    } else if (text[i] === '`') {
      const start = i;
      i++;
      while (i < text.length && text[i] !== '`') i++;
      if (i < text.length) {
        i++;
        ranges.push({ start, end: i });
      }
    } else {
      i++;
    }
  }

  return ranges;
}

function isProtected(index: number, ranges: Range[]): boolean {
  return ranges.some(r => index >= r.start && index < r.end);
}

// ============================================================================
// Scanner de tags genérico
// ============================================================================

export function scanTags(rawText: string): RawTag[] {
  const protectedRanges = getInlineBacktickRanges(rawText);
  const tags: RawTag[] = [];
  let i = 0;

  const skipProtected = () => {
    for (const r of protectedRanges) {
      if (i >= r.start && i < r.end) i = r.end;
    }
  };

  while (i < rawText.length) {
    skipProtected();
    if (i >= rawText.length) break;

    if (rawText[i] !== '<') { i++; continue; }

    const tagStart = i;
    i++; // '<'

    // Nombre del tag
    let name = '';
    while (i < rawText.length && rawText[i] !== ' ' && rawText[i] !== '>' && rawText[i] !== '/') {
      name += rawText[i];
      i++;
    }
    if (name.length === 0) continue;

    // Atributos
    const attrs: Record<string, string> = {};
    while (i < rawText.length && rawText[i] !== '>' && rawText[i] !== '/') {
      while (i < rawText.length && rawText[i] === ' ') i++;
      if (rawText[i] === '>' || rawText[i] === '/') break;

      let attrName = '';
      while (i < rawText.length && rawText[i] !== '=' && rawText[i] !== ' ' && rawText[i] !== '>' && rawText[i] !== '/') {
        attrName += rawText[i];
        i++;
      }
      if (attrName.length === 0) break;

      while (i < rawText.length && rawText[i] === ' ') i++;
      if (rawText[i] === '=') {
        i++;
        while (i < rawText.length && rawText[i] === ' ') i++;
        if (rawText[i] === '"' || rawText[i] === "'") {
          const q = rawText[i];
          i++;
          let val = '';
          while (i < rawText.length && rawText[i] !== q) {
            val += rawText[i];
            i++;
          }
          if (rawText[i] === q) i++;
          attrs[attrName] = val;
        }
      }
    }

    // Self-closing?
    if (i < rawText.length && rawText[i] === '/') {
      i++;
      if (i < rawText.length && rawText[i] === '>') {
        i++;
        tags.push({ name: name.toLowerCase(), attributes: attrs, content: null, isSelfClosing: true, startIndex: tagStart, endIndex: i });
      }
      continue;
    }

    if (i < rawText.length && rawText[i] === '>') {
      i++;
      while (i < rawText.length && (rawText[i] === ' ' || rawText[i] === '\n' || rawText[i] === '\r' || rawText[i] === '\t')) {
        i++;
      }
      const contentStart = i;
      const openTag = `<${name}`;
      const closeTag = `</${name}>`;
      let depth = 1;

      while (i < rawText.length && depth > 0) {
        skipProtected();
        if (i >= rawText.length) break;

        if (rawText.substring(i, i + closeTag.length) === closeTag) {
          depth--;
          if (depth === 0) { i += closeTag.length; break; }
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
        tags.push({ name: name.toLowerCase(), attributes: attrs, content, isSelfClosing: false, startIndex: tagStart, endIndex: i });
      }
      // Si depth != 0, el tag no se cierra → se ignora
    }
  }

  return tags;
}

// ============================================================================
// Extractores de nodos
// ============================================================================

export function extractNodes(rawText: string): ExtractedNode[] {
  const rawTags = scanTags(rawText);
  const nodes: ExtractedNode[] = [];

  for (const tag of rawTags) {
    switch (tag.name) {
      case 'cmd':
        nodes.push({ type: 'cmd', payload: unescapeXml((tag.content ?? '').trim()) });
        break;
      case 'file':
        nodes.push({ type: 'file', payload: unescapeXml(tag.attributes['path'] ?? ''), content: unescapeXml(tag.content ?? '') });
        break;
      case 'tree':
        nodes.push({ type: 'tree', payload: unescapeXml(tag.attributes['path'] ?? '') });
        break;
      // Futuras herramientas aqui
    }
  }

  return nodes;
}

// ============================================================================
// Clase pública
// ============================================================================

export class LLMParser {
  static parse(rawText: string): ActionNode[] {
    return extractNodes(rawText).map(node => ({
      id: crypto.randomUUID(),
      type: node.type,
      payload: node.payload,
      content: node.content,
      status: 'pending',
      result: null
    }));
  }
}
