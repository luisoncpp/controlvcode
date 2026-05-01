import type { DiffFile, DiffHunk, DiffLine } from "./types";

export function parseGitDiff(diffText: string): DiffFile[] {
  if (!diffText.trim()) return [];

  const files: DiffFile[] = [];
  const lines = diffText.split("\n");
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith("diff --git")) {
      const result = parseFile(lines, i);
      files.push(result.file);
      i = result.nextIndex;
    } else {
      i++;
    }
  }

  return files;
}

function parseFile(
  lines: string[],
  startIndex: number
): { file: DiffFile; nextIndex: number } {
  let i = startIndex;

  let path = "";
  let oldPath = "";
  let newPath = "";
  let isNew = false;
  let isDeleted = false;
  let isRenamed = false;
  const hunks: DiffHunk[] = [];

  const diffMatch = lines[i].match(/diff --git a\/(.+?) b\/(.+)/);
  if (diffMatch) {
    oldPath = diffMatch[1];
    newPath = diffMatch[2];
    path = newPath;
  }
  i++;

  while (i < lines.length && !lines[i].startsWith("@@")) {
    const line = lines[i];
    if (line.startsWith("new file mode")) {
      isNew = true;
    } else if (line.startsWith("deleted file mode")) {
      isDeleted = true;
    } else if (line.startsWith("rename from")) {
      isRenamed = true;
      oldPath = line.slice(12);
    } else if (line.startsWith("rename to")) {
      newPath = line.slice(10);
      path = newPath;
    } else if (line.startsWith("--- ")) {
      const p = line.slice(4);
      if (p !== "/dev/null") oldPath = p.replace(/^a\//, "");
    } else if (line.startsWith("+++ ")) {
      const p = line.slice(4);
      if (p !== "/dev/null") {
        newPath = p.replace(/^b\//, "");
        path = newPath;
      }
    } else if (line.startsWith("diff --git")) {
      break;
    }
    i++;
  }

  while (i < lines.length) {
    if (lines[i].startsWith("diff --git")) break;
    if (lines[i].startsWith("@@")) {
      const result = parseHunk(lines, i);
      hunks.push(result.hunk);
      i = result.nextIndex;
    } else {
      i++;
    }
  }

  const additions = hunks.reduce(
    (sum, h) => sum + h.lines.filter((l) => l.type === "add").length,
    0
  );
  const deletions = hunks.reduce(
    (sum, h) => sum + h.lines.filter((l) => l.type === "remove").length,
    0
  );

  return {
    file: {
      path,
      oldPath,
      newPath,
      isNew,
      isDeleted,
      isRenamed,
      additions,
      deletions,
      hunks,
    },
    nextIndex: i,
  };
}

function parseHunk(
  lines: string[],
  startIndex: number
): { hunk: DiffHunk; nextIndex: number } {
  const headerLine = lines[startIndex];
  const match = headerLine.match(
    /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@\s?(.*)/
  );

  const oldStart = match ? parseInt(match[1], 10) : 0;
  const oldCount = match ? parseInt(match[2] || "1", 10) : 0;
  const newStart = match ? parseInt(match[3], 10) : 0;
  const newCount = match ? parseInt(match[4] || "1", 10) : 0;
  const header = match ? match[5] : "";

  const hunkLines: DiffLine[] = [];
  let oldLine = oldStart;
  let newLine = newStart;
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("@@") || line.startsWith("diff --git")) break;

    if (line.startsWith("+")) {
      hunkLines.push({
        type: "add",
        content: line.slice(1),
        oldLineNumber: null,
        newLineNumber: newLine++,
      });
    } else if (line.startsWith("-")) {
      hunkLines.push({
        type: "remove",
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: null,
      });
    } else if (line.startsWith("\\")) {
      hunkLines.push({
        type: "no-newline",
        content: line,
        oldLineNumber: null,
        newLineNumber: null,
      });
    } else if (line.startsWith(" ")) {
      hunkLines.push({
        type: "context",
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      });
    } else if (line === "") {
      hunkLines.push({
        type: "context",
        content: "",
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      });
    } else {
      break;
    }
    i++;
  }

  return {
    hunk: {
      oldStart,
      oldCount,
      newStart,
      newCount,
      header,
      lines: hunkLines,
    },
    nextIndex: i,
  };
}
