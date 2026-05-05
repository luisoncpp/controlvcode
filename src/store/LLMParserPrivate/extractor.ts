
import type { ActionType } from '../../types';
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

function extractOptions(tag: RawTag, keys: string[]): Record<string, string> | undefined {
  const opts: Record<string, string> = {};
  for (const key of keys) {
    const val = tag.attributes[key];
    if (val) opts[key] = val;
  }
  return Object.keys(opts).length > 0 ? opts : undefined;
}

function buildNode(tag: RawTag, schema: TagSchema): ExtractedNode {
  const node: ExtractedNode = {
    type: tag.name as ActionType,
    payload: schema.payload !== undefined
      ? extractField(schema.payload, tag, schema.trimPayload)
      : '',
  };
  if (schema.content !== undefined) {
    node.content = extractField(schema.content, tag);
  }
  if (schema.newContent !== undefined) {
    node.newContent = extractField(schema.newContent, tag);
  }
  if (schema.options) {
    node.options = extractOptions(tag, schema.options);
  }
  return node;
}

export function extractNodes(rawText: string): ExtractedNode[] {
  return scanTags(rawText)
    .filter(tag => TAG_SCHEMAS[tag.name] !== undefined)
    .map(tag => buildNode(tag, TAG_SCHEMAS[tag.name]));
}
