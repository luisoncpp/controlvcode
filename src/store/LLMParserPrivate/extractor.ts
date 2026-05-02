import type { ExtractedNode } from './types';
import { scanTags } from './scanner';
import { unescapeXml } from './unescapeXml';

export function extractNodes(rawText: string): ExtractedNode[] {
  const rawTags = scanTags(rawText);
  const nodes: ExtractedNode[] = [];

  for (const tag of rawTags) {
    switch (tag.name) {
      case 'cmd':
        nodes.push({
          type: 'cmd',
          payload: unescapeXml((tag.content ?? '').trim()),
        });
        break;
      case 'file':
        nodes.push({
          type: 'file',
          payload: unescapeXml(tag.attributes['path'] ?? ''),
          content: unescapeXml(tag.content ?? ''),
        });
        break;
      case 'tree':
        nodes.push({
          type: 'tree',
          payload: unescapeXml(tag.attributes['path'] ?? ''),
        });
        break;
      // Futuras herramientas aquí
    }
  }

  return nodes;
}
