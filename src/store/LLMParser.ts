import type { ActionNode } from '../types';

// Importaciones privadas (solo este archivo las toca directamente)
import { unescapeXml } from './LLMParserPrivate/unescapeXml';
import { getInlineBacktickRanges } from './LLMParserPrivate/backtickRanges';
import { scanTags } from './LLMParserPrivate/scanner';
import { extractNodes } from './LLMParserPrivate/extractor';

// Re-exportamos las mismas funciones que antes estaban públicas
export { unescapeXml, getInlineBacktickRanges, scanTags, extractNodes };

export class LLMParser {
  static parse(rawText: string): ActionNode[] {
    return extractNodes(rawText).map(node => ({
      id: crypto.randomUUID(),
      type: node.type,
      payload: node.payload,
      content: node.content,
      options: node.options,
      status: 'pending',
      result: null
    }));
  }
}
