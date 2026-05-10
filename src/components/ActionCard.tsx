
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
    <div className={`p-4 rounded-lg border transition-all duration-200 bg-[#161b22] ${borderClass}`}>
      <CardHeader node={node} isActive={isActive} actions={actions} />
      <pre className="text-sm font-mono text-[#e6edf3] bg-[#0d1117] p-3 rounded-md border border-[#30363d] whitespace-pre-wrap break-words">
        {node.payload}
      </pre>
      <ResultDisplay result={node.result} />
    </div>
  );
}

function getBorderClass(node: ActionNode, isActive: boolean): string {
  if (node.type === 'parse_error' && node.status === 'pending') {
    return isActive ? 'border-[#da3633] shadow-[0_0_12px_rgba(218,54,51,0.25)]' : 'border-[#30363d]';
  }
  
  if (node.status === 'pending') return isActive ? 'border-[#2f81f7] shadow-[0_0_12px_rgba(47,129,247,0.2)]' : 'border-[#30363d]';
  if (node.status === 'running') return 'border-[#d29922]';
  if (node.status === 'success') return 'border-[#238636]';
  if (node.status === 'error') return 'border-[#da3633]';
  return 'border-[#30363d] opacity-50';
}

function CardHeader({ node, isActive, actions }: ActionProps) {
  return (
    <div className="flex justify-between items-start mb-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#7d8590]">
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
        <button 
          onClick={actions.showDetails} 
          className="w-8 h-8 flex items-center justify-center rounded-md bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[#7d8590] transition-colors duration-200" 
          title="Ver detalles"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>
      )}
      <button 
        disabled={isDisabled} 
        onClick={actions.execute} 
        className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 bg-[#238636] hover:bg-[#2ea043] text-white disabled:bg-[#21262d] disabled:text-[#484f58] disabled:cursor-not-allowed"
      >
        {isRunning ? 'Ejecutando...' : 'Ejecutar'}
      </button>
      <button 
        disabled={isDisabled} 
        onClick={actions.skip} 
        className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] disabled:bg-[#161b22] disabled:text-[#484f58] disabled:border-[#21262d] disabled:cursor-not-allowed"
      >
        Omitir
      </button>
    </>
  );
}

function ResultDisplay({ result }: { result: ExecutionResult | null }) {
  if (!result) return null;
  return (
    <div className="mt-3 bg-[#0d1117] border border-[#30363d] rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-words">
      {result.stdout && <div className="text-[#3fb950]">{result.stdout}</div>}
      {result.stderr && <div className="text-[#f85149] mt-2">{result.stderr}</div>}
    </div>
  );
}
