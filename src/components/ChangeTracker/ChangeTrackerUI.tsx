import { ChangeTracker } from "./ChangeTracker";

export function ChangeTrackerUI({ tracker }: { tracker: ChangeTracker }) {
  return (
    <div className="mt-6 border border-gray-700 rounded bg-gray-800">
      <div className="flex justify-between items-center p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300">Control de Cambios</h3>
        <div className="flex gap-2">
          <button
            disabled={!tracker.snapshotHash.value || tracker.isRestoring.value}
            onClick={() => tracker.computeDiff()}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm disabled:opacity-50"
          >
            Actualizar Diff
          </button>
          <button
            disabled={!tracker.snapshotHash.value || tracker.isRestoring.value}
            onClick={() => {
              if (confirm("¿Revertir TODOS los cambios y eliminar archivos nuevos?")) {
                tracker.revert(true);
              }
            }}
            className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm disabled:opacity-50"
          >
            Revertir
          </button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-xs text-gray-400 font-mono max-h-96 overflow-y-auto whitespace-pre-wrap">
        {tracker.diffOutput.value || "El diff aparecerá aquí cuando finalice la ejecución de la cola."}
      </pre>
      {tracker.error.value && (
        <div className="p-2 text-red-400 text-sm border-t border-gray-700">{tracker.error.value}</div>
      )}
    </div>
  );
}