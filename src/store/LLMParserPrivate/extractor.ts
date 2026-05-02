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
      case 'read': {
        const opts: Record<string, string> = {};
        if (tag.attributes['start']) opts.start = tag.attributes['start'];
        if (tag.attributes['end']) opts.end = tag.attributes['end'];
        if (tag.attributes['line']) opts.line = tag.attributes['line'];
        if (tag.attributes['count']) opts.count = tag.attributes['count'];
        nodes.push({
          type: 'read',
          payload: unescapeXml(tag.attributes['path'] ?? ''),
          options: Object.keys(opts).length > 0 ? opts : undefined,
        });
        break;
      }
      case 'replace': {
        const ropts: Record<string, string> = {};
        if (tag.attributes['occurrence']) ropts.occurrence = tag.attributes['occurrence'];
        nodes.push({
          type: 'replace',
          payload: unescapeXml(tag.attributes['path'] ?? ''),
          content: unescapeXml(tag.attributes['old'] ?? ''),
          newContent: unescapeXml(tag.attributes['new'] ?? ''),
          options: Object.keys(ropts).length > 0 ? ropts : undefined,
        });
        break;
      }
    }
  }

  return nodes;
}
