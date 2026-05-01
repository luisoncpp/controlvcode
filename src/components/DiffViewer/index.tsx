import { useMemo } from "preact/hooks";
import { parseGitDiff } from "./parser";
import { DiffFile } from "./DiffFile";

interface DiffViewerProps {
  diff: string;
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const files = useMemo(() => parseGitDiff(diff), [diff]);

  if (!diff.trim()) {
    return (
      <div className="p-4 text-[#8b949e] text-xs italic">
        El diff aparecerá aquí cuando finalice la ejecución de la cola.
      </div>
    );
  }

  if (files.length === 0) {
    return <div className="p-4 text-[#8b949e] text-xs">Sin diferencias.</div>;
  }

  return (
    <div className="font-mono">
      {files.map((file, idx) => (
        <DiffFile key={idx} file={file} />
      ))}
    </div>
  );
}
