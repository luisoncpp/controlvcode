import { useStore } from '../context/StoreContext';
import { ActionCard } from './ActionCard';

export function QueueViewer() {
  const store = useStore();
  const nodes = store.nodes.value;

  const activeNodes = nodes
    .map((node, realIndex) => ({ node, realIndex }))
    .filter(({ node }) => node.status === 'pending' || node.status === 'running' || node.status === 'error');

  if (activeNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-12 border border-dashed border-gray-700 rounded text-gray-500">
        No hay comandos en la cola. Pega texto en el panel izquierdo.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {activeNodes.map(({ node, realIndex }) => (
        <ActionCard key={node.id} index={realIndex} />
      ))}
    </div>
  );
}
