
import { useEffect } from "preact/hooks";
import { ExecutionStore } from './store/ExecutionStore';
import { StoreContext } from './context/StoreContext';
import { PromptInput } from './components/PromptInput';
import { QueueViewer } from './components/QueueViewer';
import { FeedbackPanel } from './components/FeedbackPanel';
import { ChangeTracker } from "./components/ChangeTracker/ChangeTracker";
import { ChangeTrackerUI } from "./components/ChangeTracker/ChangeTrackerUI";
import { PromptBuilderComponent } from "./components/PromptBuilder";
import { TopBar } from "./components/TopBar";
import { ResizablePanel } from "./components/ResizablePanel";

const store = new ExecutionStore();
const changeTracker = new ChangeTracker();

store.onPreExecute = () => changeTracker.onInstructionExecute();

export function App() {
  useEffect(() => {
    changeTracker.onInstructionsChange();
  }, [store.rawInput.value]);

  useEffect(() => {
    const pendingOrRunning = store.nodes.value.filter(
      n => n.status === "pending" || n.status === "running"
    ).length;
    if (pendingOrRunning === 0) {
      changeTracker.requestDiffWhenReady();
    }
  }, [store.nodes.value]);

  return (
    <StoreContext.Provider value={store}>
      <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
        <TopBar />
        
        <div className="flex flex-1 overflow-hidden">
          <ResizablePanel>
            {(isCompact) => <PromptInput isCompact={isCompact} />}
          </ResizablePanel>

          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0">
              <h1 className="text-xl font-bold text-gray-200">Cola de Comandos</h1>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <QueueViewer />
              <ChangeTrackerUI tracker={changeTracker} />
              <FeedbackPanel />
            </div>
            <PromptBuilderComponent feedbackXml={store.feedbackPrompt.value} />
          </main>
        </div>
      </div>
    </StoreContext.Provider>
  );
}
