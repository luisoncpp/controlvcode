# Compare-TDD: Diff automático entre cambios del LLM

## 🧠 PropósitReducir la carga cognitiva al revisar los cambios generados por un LLM. Antes de ejecutar la primera acción de cada tanda de comandos se toma una instantánea del árbol de trabajo con Git. Al finalizar la cola, se muestra un diff unificado de todo lo que se alteró o creó. Se puede revertir al estado previo con un clic.

## 🏗 Arquitectura general
La funcionalidad está encapsulada en una **clase `ChangeTracker`** (lógica de negocio) y un **componente visual `ChangeTrackerUI`** (solo renderizado). El resto de la aplicación no se modifica, salvo dos puntos mínimos:

- **`ExecutionStore`** expone un callback `onPreExecute` que se invoca justo antes de ejecutar cualquier acción.
- **`App.tsx`** asigna ese callback para conectar el store con el tracker y renderiza el componente visual.

```
src/
  components/
    ChangeTracker/
      ChangeTracker.ts      ← Clase con lógica y señales
      ChangeTrackerUI.tsx   ← Componente visual
src-tauri/
  src/
    git_commands.rs         ← Comandos Tauri para Git
    lib.rs                  ← Registro
```

---

## 🔙 Backend (Rust)

### `git_commands.rs`
Comandos Tauri que operan desde `project_root()`.

#### `snapshot_create() -> Result<String, String>`
Ejecuta `git stash create` y devuelve el hash del commit (vacío si no hay cambios).

#### `snapshot_diff(hash: String) -> Result<ExecutionResult, String>`
Ejecuta `git diff <hash>`. Si el hash está vacío, compara contra `HEAD`.

#### `snapshot_restore(hash: String, clean_untracked: bool) -> Result<ExecutionResult, String>`
Ejecuta `git restore --source=<hash> -- .` y, si `clean_untracked` es `true`, `git clean -fd` para eliminar archivos no rastreados (creados por `<file>`). Requiere confirmación explícita del usuario.

#### Registro en `lib.rs`
Se añade `mod git_commands;` y se incluyen los handlers en `generate_handler![]`.

---

## 🧩 Clase `ChangeTracker`

Encapsula toda la lógica. Utiliza `signal` de Preact para exponer estado reactivo al componente visual. No depende de hooks, contextos ni librerías de UI.

### API pública

| Método | Descripción |
|--------|-------------|
| `onInstructionsChange()` | Marca el tracker como **dirty**. Se llama cuando el usuario modifica el prompt. |
| `onInstructionExecute()` | Si está **dirty**, toma un snapshot de Git y se desmarca. Se llama justo antes de ejecutar cada acción. |
| `computeDiff()` | Calcula el diff entre el snapshot y el árbol actual. Se llama al vaciarse la cola. |
| `revert(cleanUntracked)` | Restaura el proyecto al estado del snapshot. Si `cleanUntracked` es `true`, limpia archivos nuevos. |

### Lógica interna

```ts
// src/components/ChangeTracker/ChangeTracker.ts
import { signal } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import type { ExecutionResult } from "../../types";

export class ChangeTracker {
  public snapshotHash = signal<string | null>(null);
  public diffOutput = signal("");
  public isRestoring = signal(false);
  public error = signal("");

  private dirty = false;
  private gitAvailable = true;

  onInstructionsChange() {
    this.dirty = true;
    this.diffOutput.value = "";
  }

  async onInstructionExecute() {
    if (!this.dirty || !this.gitAvailable) return;
    this.dirty = false;

    try {
      const hash = await invoke<string>("snapshot_create");
      this.snapshotHash.value = hash || null;
    } catch {
      this.gitAvailable = false;
      this.error.value = "No se detectó un repositorio Git. El diff estará deshabilitado.";
    }
  }

  async computeDiff() {
    const hash = this.snapshotHash.value;
    if (!hash && this.gitAvailable) {
      this.diffOutput.value = "No hay snapshot para comparar.";
      return;
    }
    try {
      const result = await invoke<ExecutionResult>("snapshot_diff", { hash: hash ?? "" });
      this.diffOutput.value = result.stdout || "Sin diferencias.";
    } catch (e) {
      this.diffOutput.value = `Error al generar diff: ${e}`;
    }
  }

  async revert(cleanUntracked: boolean) {
    const hash = this.snapshotHash.value;
    if (!hash) return;
    this.isRestoring.value = true;
    try {
      await invoke("snapshot_restore", { hash, cleanUntracked });
      this.diffOutput.value = "Cambios revertidos al estado de la instantánea.";
      this.snapshotHash.value = null;
    } catch (e) {
      this.error.value = `Error al revertir: ${e}`;
    } finally {
      this.isRestoring.value = false;
    }
  }
}
```

---

## 🔌 Conexión en `App.tsx`

Se utiliza un callback directo en `ExecutionStore` para evitar `useEffect` sobre arrays de nodos. Así la notificación es explícita y el store no conoce al tracker.

### Cambio en `ExecutionStore`

```ts
export class ExecutionStore {
  // ...
  public onPreExecute: (() => void) | null = null;

  public async executeNode(index: number) {
    // ...
    this.onPreExecute?.();
    // ...
  }
}
```

### Cambio en `App.tsx`

```tsx
import { ChangeTracker } from "./components/ChangeTracker/ChangeTracker";
import { ChangeTrackerUI } from "./components/ChangeTracker/ChangeTrackerUI";

const store = new ExecutionStore();
const changeTracker = new ChangeTracker();

// Conectar el tracker al store
store.onPreExecute = () => changeTracker.onInstructionExecute();

export function App() {
  // Efecto para marcar dirty cuando cambia el prompt
  useEffect(() => {
    changeTracker.onInstructionsChange();
  }, [store.rawInput.value]);

  // Efecto para calcular diff cuando la cola se vacía
  useEffect(() => {
    const pendingOrRunning = store.nodes.value.filter(
      n => n.status === "pending" || n.status === "running"
    ).length;
    if (pendingOrRunning === 0 && changeTracker.snapshotHash.value) {
      changeTracker.computeDiff();
    }
  }, [store.nodes.value, changeTracker.snapshotHash.value]);

  return (
    <StoreContext.Provider value={store}>
      {/* ... layout actual ... */}
      <ChangeTrackerUI tracker={changeTracker} />
    </StoreContext.Provider>
  );
}
```

**Nota:** El `useEffect` para `onInstructionsChange` se mantiene por simplicidad (reaccionar a cambios en una señal es su uso natural). El diff se calcula también con `useEffect` porque depende de `store.nodes.value` y es una consulta derivada. La parte crítica de ejecución usa el callback explícito, que era la que generaba confusión.

---

## 🖥️ Componente visual `ChangeTrackerUI`

Recibe la instancia de `ChangeTracker` como prop. Sin lógica de negocio propia.

```tsx
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
              if (confirm("¿Revertir todos los cambios en archivos pre-existentes?")) {
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
```

---

## 🔁 Flujo de usuario completo

1. El usuario pega un prompt. Se parsean las etiquetas.
2. Al cambiar el texto, `onInstructionsChange()` marca el tracker como **dirty**.
3. El usuario hace clic en **Ejecutar** en la primera acción.
   - El store llama a `onPreExecute`, que invoca `changeTracker.onInstructionExecute()`.
   - Como está **dirty**, se toma un snapshot Git y se desmarca **dirty**.
4. El usuario ejecuta/omite el resto de acciones. Las llamadas sucesivas a `onInstructionExecute` no hacen nada porque `dirty` es `false`.
5. Al vaciarse la cola, el `useEffect` en `App` detecta que no hay nodos pendientes y hay un snapshot → llama a `computeDiff()`.
6. Se muestra el diff en el panel **Control de Cambios**.
7. El usuario puede **Actualizar Diff** o **Revertir** (con confirmación de limpieza de archivos nuevos).

Si el usuario modifica el prompt después de ejecutar, `dirty` vuelve a `true`, el diff se limpia, y el flujo se reinicia al ejecutar de nuevo.

---

## 🔒 Seguridad y alcance

- Los comandos Git operan exclusivamente en el directorio del proyecto.
- La reversión es destructiva y requiere confirmación explícita.
- Si no hay repositorio Git, el error se captura y se muestra un mensaje. La app sigue funcional.
- Los snapshots son objetos internos de Git (`git stash create`). No pueblan el stash stack del usuario.

---

## 📦 Plan de implementación

1. Crear `src-tauri/src/git_commands.rs` con los tres comandos.
2. Registrar en `lib.rs`.
3. Añadir `onPreExecute` en `ExecutionStore` (una línea) e invocarlo en `executeNode`.
4. Crear `src/components/ChangeTracker/ChangeTracker.ts` con la clase.
5. Crear `src/components/ChangeTracker/ChangeTrackerUI.tsx` con el componente.
6. Modificar `App.tsx`: instanciar, conectar callback, agregar efectos y renderizar `<ChangeTrackerUI>`.
7. Probar en un repositorio Git real: pegar, ejecutar, revisar diff, revertir.

---

> *Compare-TDD convierte el feedback loop en un ciclo de revisión completa: ejecutar, inspeccionar y decidir.*

5. **Probar** en un repositorio Git existente: pegar comandos, ejecutar, ver diff, revertir.

---

> **Nota:** Esta funcionalidad inaugura la fase de "review" del proyecto, dando visibilidad total sobre los cambios realizados por el LLM antes de integrarlos definitivamente.
 **Probar** en un repositorio Git existente: pegar comandos, ejecutar, ver diff, revertir.

---

> **Nota:** Esta funcionalidad inaugura la fase de "review" del proyecto, dando visibilidad total sobre los cambios realizados por el LLM antes de integrarlos definitivamente.
 **Probar** en un repositorio Git existente: pegar comandos, ejecutar, ver diff, revertir.

---

> **Nota:** Esta funcionalidad inaugura la fase de "review" del proyecto, dando visibilidad total sobre los cambios realizados por el LLM antes de integrarlos definitivamente.
