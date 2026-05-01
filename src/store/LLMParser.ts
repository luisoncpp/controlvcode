import { ActionNode } from '../types';

interface Range {
  start: number;
  end: number;
}

export class LLMParser {
  static parse(rawText: string): ActionNode[] {
    const nodes: ActionNode[] = [];
    const protectedRanges = this.getInlineBacktickRanges(rawText);

    const isProtected = (index: number) =>
      protectedRanges.some(r => index >= r.start && index < r.end);

    const cmdRegex = /<cmd>([\s\S]*?)<\/cmd>/g;
    let match;
    while ((match = cmdRegex.exec(rawText)) !== null) {
      if (isProtected(match.index)) continue;
      nodes.push({
        id: crypto.randomUUID(),
        type: 'cmd',
        payload: match[1].trim(),
        status: 'pending',
        result: null
      });
    }

    const fileRegex = /<file\s+[^>]*path="([^"]+)"[^>]*>\s*([\s\S]*?)<\/file>/g;
    while ((match = fileRegex.exec(rawText)) !== null) {
      if (isProtected(match.index)) continue;
      nodes.push({
        id: crypto.randomUUID(),
        type: 'file',
        payload: match[1].trim(),
        content: match[2],
        status: 'pending',
        result: null
      });
    }

    const treeRegex = /<tree\s+path="([^"]+)"\s*\/?>\s*(?:<\/tree>)?/g;
    while ((match = treeRegex.exec(rawText)) !== null) {
      if (isProtected(match.index)) continue;
      nodes.push({
        id: crypto.randomUUID(),
        type: 'tree',
        payload: match[1].trim(),
        status: 'pending',
        result: null
      });
    }

    return nodes;
  }

  /**
   * Recorre el texto carácter por carácter para identificar:
   * - Bloques markdown (``` ... ```): se saltan por completo, no protegen nada.
   * - Backticks inline (`...`): se registran como rangos protegidos.
   *
   * Esto evita que los regex de bloques markdown "se coman" texto
   * de forma impredecible cuando hay múltiples bloques o backticks sueltos.
   */
  private static getInlineBacktickRanges(text: string): Range[] {
    const ranges: Range[] = [];
    let i = 0;

    while (i < text.length) {
      if (
        i + 2 < text.length &&
        text[i] === '`' &&
        text[i + 1] === '`' &&
        text[i + 2] === '`'
      ) {
        i += 3;
        while (i + 2 < text.length) {
          if (
            text[i] === '`' &&
            text[i + 1] === '`' &&
            text[i + 2] === '`'
          ) {
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
}
