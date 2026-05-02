export interface Range {
  start: number;
  end: number;
}

export interface RawTag {
  name: string;
  attributes: Record<string, string>;
  content: string | null;
  isSelfClosing: boolean;
  startIndex: number;
  endIndex: number;
}

export interface ExtractedNode {
  type: 'cmd' | 'file' | 'tree' | 'read' | 'replace';
  payload: string;
  content?: string;
  newContent?: string;            // para replace
  options?: Record<string, string>;
}
