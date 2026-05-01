import { useStore } from '../context/StoreContext';
import { ActionCard } from './ActionCard';

export function QueueViewer() {
  const store = useStore();
  const nodes = store.nodes.value;

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 border border-dashed border-gray-700 rounded text-gray-500">
        No hay comandos en la cola. Pega texto en el panel izquierdo.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {nodes.map((node, index) => (
        <ActionCard key={node.id} index={index} />
      ))}
    </div>
  );
}