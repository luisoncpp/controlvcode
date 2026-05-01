export interface DiffFile {
  path: string;
  oldPath: string;
  newPath: string;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "context" | "add" | "remove" | "no-newline";
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface LineGroup {
  type: "context" | "changes";
  lines: DiffLine[];
}
