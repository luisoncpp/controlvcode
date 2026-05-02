# PromptBuilder – Arquitectura

## 🧠 Propósito
`PromptBuilder` permite al usuario componer prompts complejos para un LLM combinando tres fuentes:
1. El XML de retroalimentación (`<execution_results>`) generado por la ejecución de comandos.
2. Un mensaje de texto libre escrito por el usuario.
3. Archivos del proyecto adjuntados mediante búsqueda interactiva con `@`.

Todo encapsulado en `src/components/PromptBuilder/`, con un único punto de entrada `index.tsx` que no expone dependencias internas al resto de la aplicación.

---

## 🗂️ Estructura de archivos

```
src/components/PromptBuilder/
  index.tsx              ← Componente fachada (único export)
  PromptBuilder.ts       ← Clase de lógica y estado
  PromptBuilderUI.tsx    ← Componente visual principal
  FileSearchDropdown.tsx ← Dropdown de autocompletado de archivos
  types.ts               ← Tipos locales (AttachedFile)
```

---

## 📄 Descripción de cada archivo

### `index.tsx`
**Rol**: Punto de entrada público. Instancia la clase `PromptBuilder` y renderiza la UI.

```tsx
export function PromptBuilderComponent({ feedbackXml }: { feedbackXml: string }) {
  const builder = new PromptBuilder(feedbackXml);
  return <PromptBuilderUI builder={builder} />;
}
```

- Recibe el feedback XML como prop desde `App.tsx`.
- Crea una nueva instancia cada vez que `feedbackXml` cambia (Preact optimiza re-renderizados). En el futuro se podría memoizar.

### `PromptBuilder.ts`
**Rol**: Toda la lógica de estado, búsqueda, adjunción y construcción del prompt final. Es una clase pura que usa `signal` de Preact para reactividad.

#### Estado (signals)
- `message`: Texto libre del usuario.
- `attachedFiles`: Lista de archivos adjuntos (`AttachedFile[]`).
- `searchResults`: Resultados actuales de búsqueda de archivos.
- `showDropdown`: Controla la visibilidad del dropdown.
- `searchQuery`: Subcadena después del `@` que se usa para buscar.

#### Métodos principales

| Método | Descripción |
|--------|-------------|
| `onMessageChange(text)` | Actualiza `message`. Si contiene `@` sin espacio posterior, activa búsqueda debounced (200ms). |
| `attachFile(path)` | Invoca `read_file_content`, añade el archivo a `attachedFiles` y limpia la búsqueda. |
| `removeFile(path)` | Elimina un adjunto por ruta. |
| `buildPrompt()` | Combina feedback + mensaje + adjuntos en un string final. |
| `copyToClipboard()` | Copia el prompt generado al portapapeles. |

#### Lógica de búsqueda debounced
- Cada vez que se detecta `@`, se guarda la query y se dispara un `setTimeout` de 200ms. Si el usuario sigue escribiendo, se cancela el timer anterior. Así se evitan llamadas excesivas al backend.
- Se invoca el comando Tauri `search_files` con la query.
- Los resultados se asignan a `searchResults` y `showDropdown` se activa si hay al menos un resultado.

### `PromptBuilderUI.tsx`
**Rol**: Componente visual principal del compositor. Renderiza:
- Cabecera con título y botón "Generar y Copiar".
- Chips de archivos adjuntos (cada uno con botón × para quitar).
- Textarea con placeholder e instrucciones.
- `FileSearchDropdown` posicionado absolutamente sobre el textarea.

**Estado local**: `copied` (booleano) para mostrar confirmación de copia.

### `FileSearchDropdown.tsx`
**Rol**: Dropdown de resultados de búsqueda de archivos. Se posiciona absolutamente debajo del textarea (`bottom-full`). Cada ítem muestra un icono de archivo y la ruta. Al hacer clic, llama a `builder.attachFile(path)`.

---

## 🔌 Interacción con el backend

`PromptBuilder` se comunica exclusivamente con dos comandos Tauri:

### `search_files(query: String) -> Vec<String>`
- **Implementación**: En `lib.rs`, recorre `walkdir` desde `project_root()`, filtra carpetas ignoradas (`node_modules`, `.git`, etc.) y busca archivos cuyo nombre contenga la query (case-insensitive). Limitado a 20 resultados.
- **Uso**: `PromptBuilder.ts` → `onMessageChange` → debounce → `invoke("search_files", { query })`.

### `read_file_content(path: String) -> String`
- **Implementación**: Lee el contenido UTF-8 del archivo en `project_root()/path`.
- **Uso**: `PromptBuilder.ts` → `attachFile` → `invoke("read_file_content", { path })`.

Ambos comandos operan sobre `PROJECT_DIR` (estático global) que se actualiza con el selector de carpeta de proyecto.

---

## 🔄 Ciclo de vida de una sesión de composición

```
1. [App.tsx] Renderiza <PromptBuilder feedbackXml={store.feedbackPrompt.value} />
2. [index.tsx] Crea nueva instancia de PromptBuilder con el feedback XML.
3. [Usuario] Escribe mensaje en el textarea.
   a. Si escribe "@archivo":
      - PromptBuilder.onMessageChange detecta el @.
      - Dispara búsqueda debounced a Tauri.
      - FileSearchDropdown muestra resultados.
   b. Si selecciona un archivo:
      - PromptBuilder.attachFile(path) lee contenido con Tauri.
      - Se añade chip visual y se limpia el @query del mensaje.
4. [Usuario] Puede adjuntar varios archivos o quitarlos.
5. [Usuario] Pulsa "Generar y Copiar".
   a. PromptBuilder.buildPrompt() construye el string combinado.
   b. PromptBuilder.copyToClipboard() copia al portapapeles.
6. El prompt está listo para pegar en el LLM.
```

---

## 🧪 Pruebas

`PromptBuilder.test.ts` contiene 15 pruebas unitarias que cubren:
- Inicialización de estado.
- Detección de `@` y activación de búsqueda (con mock de `invoke`).
- Adjuntar archivos, evitar duplicados, manejar errores.
- Eliminar adjuntos.
- Construcción del prompt completo.
- Copia al portapapeles (simulada).

Las pruebas se ejecutan con `npx vitest run`.

---

## 📦 Aislamiento

- Ningún archivo de `PromptBuilder/` importa de `ExecutionStore` ni de otros componentes.
- La única dependencia externa es `@tauri-apps/api/core` (para `invoke`) y `@preact/signals`.
- Si se desea migrar a otro framework o cambiar la UI, solo hay que tocar `PromptBuilderUI.tsx` y `FileSearchDropdown.tsx`. La clase `PromptBuilder` permanece intacta.

---

## 🗺️ Posibles extensiones

- **Atajos de teclado** en el dropdown (flechas + Enter).
- **Previsualización** del prompt generado antes de copiar.
- **Múltiples proyectos** con persistencia de adjuntos por proyecto.
- **Soporte para adjuntar directorios** completos.

---

> *PromptBuilder convierte la retroalimentación en un diálogo continuo con el LLM, trayendo el contexto del proyecto al prompt de forma fluida.*
