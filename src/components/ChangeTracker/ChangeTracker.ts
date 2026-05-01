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
      // Solo guardamos si el hash no está vacío (sin cambios => no hay snapshot)
      this.snapshotHash.value = hash && hash.length > 0 ? hash : null;
    } catch {
      this.gitAvailable = false;
      this.error.value = "No se detectó un repositorio Git. El diff estará deshabilitado.";
    }
  }

  async computeDiff() {
    const hash = this.snapshotHash.value;
    if (!hash) {
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
    if (!hash) {
      this.error.value = "No hay snapshot que revertir.";
      return;
    }
    this.isRestoring.value = true;
    try {
      await invoke("snapshot_restore", { hash, cleanUntracked });
      this.diffOutput.value = "Cambios revertidos exitosamente.";
      this.snapshotHash.value = null;
    } catch (e) {
      this.error.value = `Error al revertir: ${e}`;
    } finally {
      this.isRestoring.value = false;
    }
  }
}