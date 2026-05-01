import type { ActionNode } from '../types';

interface Range {
  start: number;
  end: number;
}

// ============================================================================
// Funciones puras — extraídas para testabilidad
// ============================================================================

/**
 * Recorre el texto carácter por carácter para identificar:
 * - Bloques markdown (``` ... ```): se saltan por completo, no protegen nada.
 * - Backticks inline (`...`): se registran como rangos protegidos.
 */
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
        i++; // consume closing backtick
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
  const nodes: ExtractedNode[] = [];
  const protectedRanges = getInlineBacktickRanges(rawText);

  const cmdRegex = /<cmd>([\s\S]*?)<\/cmd>/g;
  let match: RegExpExecArray | null;
  while ((match = cmdRegex.exec(rawText)) !== null) {
    if (isProtected(match.index, protectedRanges)) continue;
    nodes.push({ type: 'cmd', payload: match[1].trim() });
  }

  const fileRegex = /<file\s+[^>]*path="([^"]+)"[^>]*>\s*([\s\S]*?)<\/file>/g;
  while ((match = fileRegex.exec(rawText)) !== null) {
    if (isProtected(match.index, protectedRanges)) continue;
    nodes.push({ type: 'file', payload: match[1].trim(), content: match[2] });
  }

  const treeRegex = /<tree\s+path="([^"]+)"\s*\/?>\s*(?:<\/tree>)?/g;
  while ((match = treeRegex.exec(rawText)) !== null) {
    if (isProtected(match.index, protectedRanges)) continue;
    nodes.push({ type: 'tree', payload: match[1].trim() });
  }

  return nodes;
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
