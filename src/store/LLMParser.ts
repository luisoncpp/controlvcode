import { ActionNode } from '../types';

export class LLMParser {
  static parse(rawText: string): ActionNode[] {
    const nodes: ActionNode[] = [];
    // Busca todo lo que esté entre <cmd> y </cmd>
    const regex = /<cmd>([\s\S]*?)<\/cmd>/g;
    let match;

    while ((match = regex.exec(rawText)) !== null) {
      nodes.push({
        id: crypto.randomUUID(),
        type: 'cmd',
        payload: match[1].trim(),
        status: 'pending',
        result: null
      });
    }
    return nodes;
  }
}