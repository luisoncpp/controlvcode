
import { ChangeTracker } from "./ChangeTracker";
import { DiffViewer } from "../DiffViewer";
import { confirm } from "@tauri-apps/plugin-dialog";

export function ChangeTrackerUI({ tracker }: { tracker: ChangeTracker }) {
  return (
    <div className="mt-6 bg-[#161b22] border border-[#30363d] rounded-lg">
      <div className="flex justify-between items-center p-4 border-b border-[#30363d]">
        <h3 className="text-sm font-medium text-[#e6edf3]">Control de Cambios</h3>
        <div className="flex gap-2">
          <button
            disabled={!tracker.snapshotHash.value || tracker.isRestoring.value}
            onClick={() => tracker.computeDiff()}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Actualizar Diff
          </button>
          <button
            disabled={tracker.snapshotHash.value === null || tracker.isRestoring.value}
            onClick={async () => {
              const confirmed = await confirm(
                "¿Revertir TODOS los cambios en archivos preexistentes?",
                { title: "Revertir cambios", kind: "warning" }
              );
              if (confirmed) {
                tracker.revert(true);
              }
            }}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 bg-[#da3633] hover:bg-[#f85149] text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Revertir
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-[#0d1117] rounded-b-lg">
        <DiffViewer diff={tracker.diffOutput.value} />
      </div>

      {tracker.error.value && (
        <div className="p-3 text-[#f85149] text-sm border-t border-[#30363d]">
          {tracker.error.value}
        </div>
      )}
    </div>
  );
}
