import { useStore } from '../context/StoreContext';

export function ActionCard({ index }: { index: number }) {
  const store = useStore();
  const node = store.nodes.value[index];
  const isActive = index === store.activeIndex.value;

  const borderColors = {
    pending: isActive ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-gray-700',
    running: 'border-yellow-500',
    success: 'border-green-600',
    error: 'border-red-600',
    skipped: 'border-gray-800 opacity-50'
  };

  return (
    <div className={`p-4 border-2 rounded transition-all duration-200 bg-gray-800 ${borderColors[node.status]}`}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
          {node.type} | {node.status}
        </span>
        
        <div className="flex gap-2">
          <button 
            disabled={!isActive || node.status === 'running'}
            onClick={() => store.executeNode(index)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-semibold transition-colors"
          >
            {node.status === 'running' ? 'Ejecutando...' : 'Ejecutar'}
          </button>
          <button 
            disabled={!isActive || node.status === 'running'}
            onClick={() => store.skipNode(index)}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-600 rounded text-sm font-semibold transition-colors"
          >
            Omitir
          </button>
        </div>
      </div>

      <pre className="text-sm font-mono text-gray-200 bg-gray-950 p-3 rounded overflow-x-auto">
        {node.payload}
      </pre>

      {node.result && (
        <div className="mt-3 bg-black rounded p-3 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
          {node.result.stdout && <div className="text-green-400 whitespace-pre-wrap">{node.result.stdout}</div>}
          {node.result.stderr && <div className="text-red-400 whitespace-pre-wrap mt-2">{node.result.stderr}</div>}
        </div>
      )}
    </div>
  );
}
