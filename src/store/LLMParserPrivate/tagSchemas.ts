/**
 * Defines how to map a RawTag's attributes and content into an ExtractedNode.
 * - 'content' means the text inside the XML tag.
 * - A string (e.g., 'path') means tag.attributes[string].
 */
export type TagSchema = {
  payload?: 'content' | string;
  trimPayload?: boolean;
  content?: 'content' | string;
  newContent?: string;
  options?: string[];
};

/**
 * Declarative catalog of supported XML tags.
 * To add a new tag, just add an entry here. No switch statements needed.
 */
export const TAG_SCHEMAS: Record<string, TagSchema> = {
  cmd: {
    payload: 'content',
    trimPayload: true,
  },
  file: {
    payload: 'path',
    content: 'content',
  },
  tree: {
    payload: 'path',
  },
  read: {
    payload: 'path',
    options: ['start', 'end', 'line', 'count'],
  },
  replace: {
    payload: 'path',
    content: 'old',
    newContent: 'new',
    options: ['occurrence'],
  },
  grep: {
    payload: 'path',
    content: 'pattern',
    options: ['glob', 'ignore_case'],
  },
  patch: {
    payload: 'path',
    content: 'content',
  },
};
