import type { DiffLine as DiffLineType } from "./types";

const lineTypeStyles: Record<DiffLineType["type"], string> = {
  context: "text-[#8b949e]",
  add: "bg-[rgba(46,160,67,0.15)] border-l-[3px] border-l-[#3fb950] text-[#7ee787]",
  remove:
    "bg-[rgba(248,81,73,0.15)] border-l-[3px] border-l-[#f85149] text-[#ffa198]",
  "no-newline": "text-[#8b949e] italic",
};

const gutterStyles: Record<DiffLineType["type"], string> = {
  context: "bg-[#161b22]",
  add: "bg-[rgba(46,160,67,0.1)]",
  remove: "bg-[rgba(248,81,73,0.1)]",
  "no-newline": "bg-[#161b22]",
};

interface Props {
  line: DiffLineType;
}

export function DiffLine({ line }: Props) {
  return (
    <div className={`flex ${lineTypeStyles[line.type]}`}>
      <div
        className={`flex shrink-0 text-[#6e7681] select-none text-xs leading-6 ${gutterStyles[line.type]}`}
      >
        <div className="w-12 text-right pr-2 border-r border-[#30363d]">
          {line.oldLineNumber ?? ""}
        </div>
        <div className="w-12 text-right pr-2 border-r border-[#30363d]">
          {line.newLineNumber ?? ""}
        </div>
      </div>
      <div className="pl-3 pr-4 text-xs leading-6 whitespace-pre-wrap break-all flex-1">
        {line.type === "no-newline" ? line.content : line.content || " "}
      </div>
    </div>
  );
}
