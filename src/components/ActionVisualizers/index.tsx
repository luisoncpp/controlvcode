
import { ActionNode } from '../../types';
import { ReplaceVisualizer } from './ReplaceVisualizer';
import { PatchVisualizer } from './PatchVisualizer';

const JSON_INDENT_SPACES = 2;

function DefaultVisualizer({ node }: { node: ActionNode }) {
  const { result, ...displayNode } = node;
  
  return (
    <pre className="text-sm font-mono text-gray-200 bg-gray-950 p-4 rounded overflow-x-auto whitespace-pre-wrap">
      {JSON.stringify(displayNode, null, JSON_INDENT_SPACES)}
    </pre>
  );
}

const visualizers: Record<string, preact.FunctionComponent<{ node: ActionNode }>> = {
  replace: ReplaceVisualizer,
  patch: PatchVisualizer,
};

export function ActionVisualizer({ node }: { node: ActionNode }) {
  const VisualizerComponent = visualizers[node.type] || DefaultVisualizer;
  return <VisualizerComponent node={node} />;
}
