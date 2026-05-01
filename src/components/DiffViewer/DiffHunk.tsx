import { useState } from "preact/hooks";
import type { DiffHunk as DiffHunkType, DiffLine, LineGroup } from "./types";
import { DiffLine } from "./DiffLine";

interface Props {
  hunk: DiffHunkType;
}

function groupLines(lines: DiffLine[]): LineGroup[] {
  const groups: LineGroup[] = [];
  let current: LineGroup | null = null;

  for (const line of lines) {
    const isContext = line.type === "context";
    if (
      !current ||
      (isContext && current.type === "changes") ||
      (!isContext && current.type === "context")
    ) {
      current = { type: isContext ? "context" : "changes", lines: [] };
      groups.push(current);
    }
    current.lines.push(line);
  }

  return groups;
}

export function DiffHunk({ hunk }: Props) {
  const [expandedContexts, setExpandedContexts] = useState<Set<number>>(
    new Set()
  );

  const groups = groupLines(hunk.lines);

  const toggleContext = (idx: number) => {
    const next = new Set(expandedContexts);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedContexts(next);
  };

  return (
    <div className="mb-2">
      <div className="bg-[rgba(56,139,253,0.15)] text-[#58a6ff] px-4 py-1.5 text-xs font-mono border-b border-[#30363d]">
        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@{" "}
        {hunk.header}
      </div>
      <div>
        {groups.map((group, idx) => {
          if (
            group.type === "context" &&
            group.lines.length > 6 &&
            !expandedContexts.has(idx)
          ) {
            const leading = group.lines.slice(0, 3);
            const trailing = group.lines.slice(-3);
            const middleCount = group.lines.length - 6;

            return (
              <div key={idx}>
                {leading.map((line, li) => (
                  <DiffLine key={li} line={line} />
                ))}
                <button
                  onClick={() => toggleContext(idx)}
                  className="w-full text-center py-1.5 text-xs text-[#8b949e] bg-[#161b22] hover:bg-[#1f242c] border-y border-[#30363d] cursor-pointer font-mono"
                >
                  {middleCount} unmodified lines
                </button>
                {trailing.map((line, li) => (
                  <DiffLine key={li} line={line} />
                ))}
              </div>
            );
          }

          return (
            <div key={idx}>
              {group.lines.map((line, li) => (
                <DiffLine key={li} line={line} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
