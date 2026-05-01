import type { ActionNode } from '../types';

interface Range {
  start: number;
  end: number;
}

// ============================================================================
// Funciones puras — extraídas para testabilidad
// ============================================================================

export function getInlineBacktickRanges(text: string): Range[] {
  const ranges: Range[] = [];
  let i = 0;

  while (i < text.length) {
    const isBlockStart = i + 2 < text.length && text[i] === '`' && text[i + 1] === '`' && text[i + 2] === '`';
    if (isBlockStart) {
      i += 3;
      while (i + 2 < text.length) {
        const isBlockEnd = text[i] === '`' && text[i + 1] === '`' && text[i + 2] === '`';
        if (isBlockEnd) {
          i += 3;
          break;
        }
        i++;
      }
    } else if (text[i] === '`') {
      const start = i;
      i++;
      while (i < text.length && text[i] !== '`') {
        i++;
      }
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

interface ExtractedNode {
  type: ActionNode['type'];
  payload: string;
  content?: string;
}

export function extractNodes(rawText: string): ExtractedNode[] {
  const protectedRanges = getInlineBacktickRanges(rawText);
  const matches: Array<{ index: number; node: ExtractedNode }> = [];

  // Regex unificado que captura los tres tipos de tag
  const unifiedRegex = /<cmd>([\s\S]*?)<\/cmd>|<file\s+[^>]*path="([^"]+)"[^>]*>\s*([\s\S]*?)<\/file>|<tree\s+path="([^"]+)"\s*\/?>\s*(?:<\/tree>)?/g;
  let match: RegExpExecArray | null;

  while ((match = unifiedRegex.exec(rawText)) !== null) {
    if (isProtected(match.index, protectedRanges)) continue;

    if (match[1] !== undefined) {
      // Grupo 1: cmd
      matches.push({ index: match.index, node: { type: 'cmd', payload: match[1].trim() } });
    } else if (match[2] !== undefined) {
      // Grupos 2 y 3: file
      matches.push({ index: match.index, node: { type: 'file', payload: match[2].trim(), content: match[3] } });
    } else if (match[4] !== undefined) {
      // Grupo 4: tree
      matches.push({ index: match.index, node: { type: 'tree', payload: match[4].trim() } });
    }
  }

  // Ordenar por posición de aparición
  matches.sort((a, b) => a.index - b.index);

  return matches.map(m => m.node);
}

// ============================================================================
// Clase pública — fachada delgada
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