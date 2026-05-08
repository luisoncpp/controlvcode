
import { ActionNode } from '../types';
import { ActionVisualizer } from './ActionVisualizers';

interface Props {
  node: ActionNode | null;
  onClose: () => void;
}

export function ActionDetailsModal({ node, onClose }: Props) {
  if (!node) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700">
        <ModalHeader type={node.type} onClose={onClose} />
        <div className="p-4 overflow-y-auto bg-gray-900">
          <ActionVisualizer node={node} />
        </div>
        <ModalFooter onClose={onClose} />
      </div>
    </div>
  );
}

function ModalHeader({ type, onClose }: { type: string; onClose: () => void }) {
  return (
    <div className="flex justify-between items-center p-4 border-b border-gray-700">
      <h2 className="text-lg font-bold text-gray-200 uppercase tracking-wider">
        Detalles de la Acción: {type}
      </h2>
      <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl font-bold px-2">
        ✕
      </button>
    </div>
  );
}

function ModalFooter({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-4 border-t border-gray-700 flex justify-end">
      <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm font-semibold transition-colors text-white">
        Cerrar
      </button>
    </div>
  );
}
