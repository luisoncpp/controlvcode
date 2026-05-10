
import { useState, useEffect } from 'preact/hooks';
import { useStore } from '../context/StoreContext';
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export function TopBar() {
  const store = useStore();
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

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-400">Proyecto:</span>
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
  );
}
