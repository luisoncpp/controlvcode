import { ExecutionStore } from './store/ExecutionStore';
import { StoreContext } from './context/StoreContext';
import { PromptInput } from './components/PromptInput';
import { QueueViewer } from './components/QueueViewer';
import { FeedbackPanel } from './components/FeedbackPanel';

const store = new ExecutionStore();

export function App() {
  return (
    <StoreContext.Provider value={store}>
      <div className="flex h-screen bg-gray-900 text-white p-6 gap-6 overflow-hidden">
        
        <div className="w-1/3 flex flex-col h-full">
          <h2 className="text-xl font-bold mb-4 text-gray-200">Input LLM</h2>
          <PromptInput />
        </div>

        <div className="w-2/3 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-200">Cola de Comandos</h2>
            
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-sm text-gray-400">Autocopiar</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={store.autoCopy.value}
                  onChange={(e) => store.autoCopy.value = (e.target as HTMLInputElement).checked}
                />
                <div className="w-9 h-5 bg-gray-600 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform"></div>
              </div>
            </label>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 pb-4">
            <QueueViewer />
            <FeedbackPanel />
          </div>
        </div>

      </div>
    </StoreContext.Provider>
  );
}
