import { useEffect, useState } from "preact/hooks";
import { ExecutionStore } from './store/ExecutionStore';
import { StoreContext } from './context/StoreContext';
import { PromptInput } from './components/PromptInput';
import { QueueViewer } from './components/QueueViewer';
import { FeedbackPanel } from './components/FeedbackPanel';
import { ChangeTracker } from "./components/ChangeTracker/ChangeTracker";
import { ChangeTrackerUI } from "./components/ChangeTracker/ChangeTrackerUI";
import { PromptBuilderComponent } from "./components/PromptBuilder";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const store = new ExecutionStore();
const changeTracker = new ChangeTracker();

store.onPreExecute = () => changeTracker.onInstructionExecute();

export function App() {
  const [projectDir, setProjectDir] = useState("...");

  useEffect(() => {
    invoke<string>("get_project_dir").then(setProjectDir);
  }, []);

  const handleSelectProject = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      const path = typeof selected === "string" ? selected : selected;
      const newDir = await invoke<string>("set_project_dir", { path });
      setProjectDir(newDir);
    }
  };

  const shortDir = () => {
    const parts = projectDir.split(/[\\/]/).filter(Boolean);
    if (parts.length <= 2) return projectDir;
    return ".../" + parts.slice(-2).join("/");
  };

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
      <div className="flex h-screen bg-gray-900 text-white p-6 gap-6 overflow-hidden">
        
        <div className="w-1/3 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg font-semibold text-gray-300">Proyecto:</span>
            <button
              onClick={handleSelectProject}
              title={`Cambiar carpeta del proyecto (actual: ${projectDir})`}
              className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-blue-400 rounded border border-gray-600 transition-colors max-w-[240px]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="flex-shrink-0">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="truncate">{shortDir()}</span>
            </button>
          </div>
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
            <ChangeTrackerUI tracker={changeTracker} />
            <PromptBuilderComponent feedbackXml={store.feedbackPrompt.value} />
          </div>
        </div>

      </div>
    </StoreContext.Provider>
  );
}
