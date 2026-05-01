import { ActionNode } from '../types';

export class LLMParser {
  static parse(rawText: string): ActionNode[] {
    const nodes: ActionNode[] = [];

    // Detectar <cmd>...</cmd>
    const cmdRegex = /<cmd>([\s\S]*?)<\/cmd>/g;
    let match;
    while ((match = cmdRegex.exec(rawText)) !== null) {
      nodes.push({
        id: crypto.randomUUID(),
        type: 'cmd',
        payload: match[1].trim(),
        status: 'pending',
        result: null
      });
    }

    // Detectar file path="...".../file
    const fileRegex = /<file\s+[^>]*path="([^"]+)"[^>]*>\s*([\s\S]*?)<\/file>/g;
    while ((match = fileRegex.exec(rawText)) !== null) {
      nodes.push({
        id: crypto.randomUUID(),
        type: 'file',
        payload: match[1].trim(),
        content: match[2],
        status: 'pending',
        result: null
      });
    }

    // Detectar <tree path="..." /> o <tree path="..."></tree>
    const treeRegex = /<tree\s+path="([^"]+)"\s*\/?>\s*(?:<\/tree>)?/g;
    while ((match = treeRegex.exec(rawText)) !== null) {
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
}