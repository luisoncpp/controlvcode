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
  private pendingDiffRequest = false;

  onInstructionsChange() {
    this.dirty = true;
    this.diffOutput.value = "";
  }

  private async tryGrabGitSnapshot() : Promise<void> {
    try {
      const hash = await invoke<string>("snapshot_create");
      // Aceptamos incluso hash vacío: significa "no hay cambios que guardar".
      // El diff se calculará contra HEAD y mostrará "Sin diferencias" si no hay cambios.
      this.snapshotHash.value = hash ?? '';
    } catch {
      this.gitAvailable = false;
      this.error.value = "No se detectó un repositorio Git. El diff estará deshabilitado.";
    }
  }

  async onInstructionExecute() {
    if (!this.dirty || !this.gitAvailable) return;
    this.dirty = false;

    await this.tryGrabGitSnapshot();

    if (this.pendingDiffRequest) {
      this.pendingDiffRequest = false;
      if (this.snapshotHash.value !== null) {
        this.computeDiff();
      }
    }
  }

  /**
   * Pide el diff. Si el snapshot ya existe, lo calcula inmediatamente.
   * Si no (aún se está creando), encola la petición para cuando termine.
   */
  requestDiffWhenReady() {
    if (this.snapshotHash.value !== null) {
      this.computeDiff();
    } else if (this.gitAvailable) {
      this.pendingDiffRequest = true;
    }
  }

  async computeDiff() {
    const hash = this.snapshotHash.value;
    if (hash === null) {
      this.diffOutput.value = "No hay snapshot para comparar.";
      return;
    }
    try {
      const result = await invoke<ExecutionResult>("snapshot_diff", { hash });
      this.diffOutput.value = result.stdout || "Sin diferencias.";
    } catch (e) {
      this.diffOutput.value = `Error al generar diff: ${e}`;
    }
  }

  async revert(cleanUntracked: boolean) {
    const hash = this.snapshotHash.value;
    if (hash === null) {
      this.error.value = "No hay snapshot que revertir.";
      return;
    }
    if (hash === '') {
      this.error.value = "No hay snapshot que revertir (no se detectaron cambios).";
      return;
    }
    this.isRestoring.value = true;
    try {
      const result = await invoke<ExecutionResult>("snapshot_restore", { hash, cleanUntracked });
      // Mostramos la salida real del backend (en modo debug saldrá el log)
      this.diffOutput.value = result.stdout || "Sin salida del comando.";
      this.snapshotHash.value = null;
    } catch (e) {
      this.error.value = `Error al revertir: ${e}`;
    } finally {
      this.isRestoring.value = false;
    }
  }
}
