import { ExecutionStore } from './store/ExecutionStore';
import { StoreContext } from './context/StoreContext';
import { PromptInput } from './components/PromptInput';
import { QueueViewer } from './components/QueueViewer';
import { FeedbackPanel } from './components/FeedbackPanel';

// Instancia única (Singleton)
const store = new ExecutionStore();

export function App() {
  return (
    <StoreContext.Provider value={store}>
      <div className="flex h-screen bg-gray-900 text-white p-6 gap-6 overflow-hidden">
        
        {/* Panel Izquierdo: Entrada */}
        <div className="w-1/3 flex flex-col h-full">
          <h2 className="text-xl font-bold mb-4 text-gray-200">Input LLM</h2>
          <PromptInput />
        </div>

        {/* Panel Derecho: Cola y Feedback */}
        <div className="w-2/3 flex flex-col h-full">
          <h2 className="text-xl font-bold mb-4 text-gray-200">Cola de Comandos</h2>
          
          <div className="flex-1 overflow-y-auto pr-2 pb-4">
            <QueueViewer />
            <FeedbackPanel />
          </div>
        </div>

      </div>
    </StoreContext.Provider>
  );
}