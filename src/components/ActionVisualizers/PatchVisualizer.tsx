
import { ActionNode } from '../../types';
import { DiffViewer } from '../DiffViewer';

interface Props {
  node: ActionNode;
}

export function PatchVisualizer({ node }: Props) {
  const diffString = node.content || '';

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
      Archivo a parchear: <span className="text-gray-200 font-mono">{path}</span>
    </div>
  );
}
