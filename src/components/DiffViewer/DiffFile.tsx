import { useState } from "preact/hooks";
import type { DiffFile as DiffFileType } from "./types";
import { DiffHunk } from "./DiffHunk";

interface Props {
  file: DiffFileType;
  defaultExpanded?: boolean;
}

export function DiffFile({ file, defaultExpanded = true }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const statusLabel = file.isNew
    ? "Añadido"
    : file.isDeleted
    ? "Eliminado"
    : file.isRenamed
    ? "Renombrado"
    : "Modificado";
  const statusColor = file.isNew
    ? "text-[#3fb950]"
    : file.isDeleted
    ? "text-[#f85149]"
    : "text-[#8b949e]";

  return (
    <div className="border border-[#30363d] rounded-md overflow-hidden mb-4 bg-[#0d1117]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#161b22] hover:bg-[#1f242c] text-left sticky top-0 z-20"
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg
            className={`w-4 h-4 text-[#8b949e] transition-transform shrink-0 ${
              expanded ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-sm text-[#c9d1d9] font-mono truncate">
            {file.path}
          </span>
          <span className={`text-xs font-semibold shrink-0 ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono shrink-0 ml-4">
          {file.additions > 0 && (
            <span className="text-[#3fb950]">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="text-[#f85149]">-{file.deletions}</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          {file.hunks.map((hunk, idx) => (
            <DiffHunk key={idx} hunk={hunk} />
          ))}
        </div>
      )}
    </div>
  );
}
