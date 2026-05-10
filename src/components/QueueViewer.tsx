
import { useState } from 'preact/hooks';
import { useStore } from '../context/StoreContext';
import { ActionCard } from './ActionCard';
import { ActionDetailsModal } from './ActionDetailsModal';
import { ActionNode } from '../types';

export function QueueViewer() {
  const store = useStore();
  const nodes = store.nodes.value;
  
  const [selectedNode, setSelectedNode] = useState<ActionNode | null>(null);

  const activeNodes = nodes
    .map((node, realIndex) => ({ node, realIndex }))
    .filter(({ node }) => node.status === 'pending' || node.status === 'running' || node.status === 'error');

  if (activeNodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 px-4 bg-[#161b22] border border-[#30363d] rounded-lg text-[#7d8590] text-sm">
        No hay comandos en la cola. Pega texto en el panel izquierdo.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {activeNodes.map(({ node, realIndex }) => (
          <ActionCard 
            key={node.id} 
            index={realIndex} 
            onShowDetails={() => setSelectedNode(node)}
          />
        ))}
      </div>
      
      <ActionDetailsModal 
        node={selectedNode} 
        onClose={() => setSelectedNode(null)} 
      />
    </>
  );
}
