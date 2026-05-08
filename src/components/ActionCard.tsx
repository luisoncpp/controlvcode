
import { useStore } from '../context/StoreContext';
import { ActionNode, ExecutionResult } from '../types';

interface ActionProps {
  node: ActionNode;
  isActive: boolean;
  actions: { execute: () => void; skip: () => void; showDetails?: () => void };
}

export function ActionCard({ index, onShowDetails }: { index: number; onShowDetails?: () => void }) {
  const store = useStore();
  const node = store.nodes.value[index];
  const isActive = index === store.activeIndex.value;
  const borderClass = getBorderClass(node, isActive);
  
  const actions = {
    execute: () => store.executeNode(index),
    skip: () => store.skipNode(index),
    showDetails: onShowDetails
  };

  return (
    <div className={`p-4 border-2 rounded transition-all duration-200 bg-gray-800 ${borderClass}`}>
      <CardHeader node={node} isActive={isActive} actions={actions} />
      <pre className="text-sm font-mono text-gray-200 bg-gray-950 p-3 rounded overflow-x-auto">
        {node.payload}
      </pre>
      <ResultDisplay result={node.result} />
    </div>
  );
}

function getBorderClass(node: ActionNode, isActive: boolean): string {
  if (node.type === 'parse_error' && node.status === 'pending') {
    return isActive ? 'border-red-500 shadow-[0_0_10px_rgba(220,38,38,0.4)]' : 'border-red-800';
  }
  
  if (node.status === 'pending') return isActive ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-gray-700';
  if (node.status === 'running') return 'border-yellow-500';
  if (node.status === 'success') return 'border-green-600';
  if (node.status === 'error') return 'border-red-600';
  return 'border-gray-800 opacity-50';
}

function CardHeader({ node, isActive, actions }: ActionProps) {
  return (
    <div className="flex justify-between items-start mb-3">
      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
        {node.type} | {node.status}
      </span>
      <div className="flex gap-2">
        <ActionButtons node={node} isActive={isActive} actions={actions} />
      </div>
    </div>
  );
}

function ActionButtons({ node, isActive, actions }: ActionProps) {
  const isRunning = node.status === 'running';
  const isDisabled = !isActive || isRunning;

  return (
    <>
      {actions.showDetails && (
        <button onClick={actions.showDetails} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold transition-colors flex items-center justify-center text-gray-200" title="Ver detalles">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>
      )}
      <button disabled={isDisabled} onClick={actions.execute} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm font-semibold transition-colors">
        {isRunning ? 'Ejecutando...' : 'Ejecutar'}
      </button>
      <button disabled={isDisabled} onClick={actions.skip} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-600 rounded text-sm font-semibold transition-colors">
        Omitir
      </button>
    </>
  );
}

function ResultDisplay({ result }: { result: ExecutionResult | null }) {
  if (!result) return null;
  return (
    <div className="mt-3 bg-black rounded p-3 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
      {result.stdout && <div className="text-green-400 whitespace-pre-wrap">{result.stdout}</div>}
      {result.stderr && <div className="text-red-400 whitespace-pre-wrap mt-2">{result.stderr}</div>}
    </div>
  );
}
