
import type { RawTag, ExtractedNode } from './types';
import { scanTags } from './Scanner';
import { unescapeXml } from './unescapeXml';
import { TAG_SCHEMAS } from './tagSchemas';
import type { TagSchema } from './tagSchemas';

function extractField(source: 'content' | string, tag: RawTag, trim = false): string {
  if (source === 'content') {
    const raw = tag.content ?? '';
    // If the agent wrapped the content in CDATA, trust it literally (skip XML unescape)
    if (tag.isCData) return trim ? raw.trim() : raw;
    return unescapeXml(trim ? raw.trim() : raw);
  }

  // 1. Check attribute first (legacy support)
  const attrValue = tag.attributes[source];
  if (attrValue !== undefined) {
    return unescapeXml(attrValue);
  }

  // 2. Fallback to child tag (e.g., <old>, <new> inside <replace>)
  if (tag.children && tag.children.length > 0) {
    const childTag = tag.children.find(c => c.name === source);
    if (childTag) {
      const raw = childTag.content ?? '';
      // Respect CDATA in children as well
      if (childTag.isCData) return trim ? raw.trim() : raw;
      return unescapeXml(trim ? raw.trim() : raw);
    }
  }

  return '';
}

export function extractNodes(rawText: string): ExtractedNode[] {
  const rawTags = scanTags(rawText);
  const nodes: ExtractedNode[] = [];

  for (const tag of rawTags) {
    const schema: TagSchema | undefined = TAG_SCHEMAS[tag.name];
    if (!schema) continue;

    const node: any = { type: tag.name };

    if (schema.payload !== undefined) {
      node.payload = extractField(schema.payload, tag, schema.trimPayload);
    }

    if (schema.content !== undefined) {
      node.content = extractField(schema.content, tag);
    }

    if (schema.newContent !== undefined) {
      node.newContent = extractField(schema.newContent, tag);
    }

    if (schema.options) {
      const opts: Record<string, string> = {};
      for (const key of schema.options) {
        const val = tag.attributes[key];
        if (val) {
          opts[key] = val;
        }
      }
      if (Object.keys(opts).length > 0) {
        node.options = opts;
      }
    }

    nodes.push(node as ExtractedNode);
  }

  return nodes;
}
