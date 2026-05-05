export interface Range {
  start: number;
  end: number;
}

export interface RawTag {
  name: string;
  attributes: Record<string, string>;
  content: string | null;
  children: RawTag[];    // Nodos hijos parseados de forma recursiva
  isSelfClosing: boolean;
  isCData?: boolean;     // true if content was wrapped in <![CDATA[...]]>
  startIndex: number;
  endIndex: number;
}

import type { ActionType } from '../../types';

export interface ExtractedNode {
  type: ActionType;
  payload: string;
  content?: string;
  newContent?: string;            // para replace
  options?: Record<string, string>;
}
