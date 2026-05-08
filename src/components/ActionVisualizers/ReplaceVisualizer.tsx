
import { ActionNode } from '../../types';
import { DiffViewer } from '../DiffViewer';

const START_LINE_NUMBER = 1;

interface Props {
  node: ActionNode;
}

export function ReplaceVisualizer({ node }: Props) {
  const diffString = generateFakeDiff(node);

  return (
    <div className="flex flex-col gap-3">
      <FileHeader path={node.payload} />
      <div className="bg-[#0d1117] rounded border border-gray-700 overflow-hidden">
        <DiffViewer diff={diffString} />
      </div>
    </div>
  );
}

function FileHeader({ path }: { path: string }) {
  return (
    <div className="text-sm text-gray-400">
      Archivo: <span className="text-gray-200 font-mono">{path}</span>
    </div>
  );
}

function generateFakeDiff(node: ActionNode): string {
  const path = node.payload || 'archivo_desconocido';
  const searchLines = (node.content || '').split('\n');
  const replaceLines = (node.newContent || '').split('\n');

  const searchCount = searchLines.length;
  const replaceCount = replaceLines.length;

  // Se añade la cabecera estricta que exige parser.ts
  let diff = `diff --git a/${path} b/${path}\n`;
  diff += `--- a/${path}\n+++ b/${path}\n`;
  diff += `@@ -${START_LINE_NUMBER},${searchCount} +${START_LINE_NUMBER},${replaceCount} @@\n`;

  diff += buildDiffLines(searchLines, '-');
  diff += buildDiffLines(replaceLines, '+');

  return diff;
}

function buildDiffLines(lines: string[], prefix: string): string {
  if (lines.length === 1 && lines[0] === '') return '';
  return lines.map(line => `${prefix}${line}`).join('\n') + '\n';
}
