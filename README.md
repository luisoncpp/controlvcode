# ControlVCode 🛠️

**ControlVCode** es un puente de ejecución local diseñado para eliminar la fricción entre las respuestas de un LLM (Large Language Model) y tu entorno de desarrollo. Permite parsear, autorizar y ejecutar comandos de terminal y manipulaciones de archivos directamente desde una interfaz de escritorio segura.

---

## 🚀 Arquitectura
El proyecto utiliza una arquitectura de **"Humano en el bucle" (Human-in-the-loop)** para garantizar la seguridad mientras se acelera el flujo de trabajo:

*   **Frontend:** Preact + TypeScript + Tailwind CSS v4. Utiliza `@preact/signals` para una reactividad de alto rendimiento y una gestión de estado desacoplada de la UI.
*   **Backend:** Rust (Tauri v2). Gestiona la comunicación segura con el sistema operativo y la ejecución de procesos hijos.
*   **Protocolo:** Comunicación mediante etiquetas XML personalizadas para facilitar el parseo y la retroalimentación.

---

## ✨ Características actuales

*   **Parser Inteligente:** Detecta automáticamente bloques `<cmd>`, `<file>` y `<tree>` dentro de cualquier texto pegado. Ignora etiquetas mencionadas dentro de backticks inline (`` `...` ``) para evitar ejecuciones accidentales.
*   **Escritura de Archivos:** Soporta la etiqueta `<file>` para crear o sobrescribir archivos directamente desde la respuesta del LLM.
*   **Exploración de Directorios:** Soporta la etiqueta `<tree>` para mostrar la estructura de carpetas del proyecto.
*   **Cola Secuencial:** Los comandos se organizan en tarjetas de acción. Solo se permite la ejecución del comando actual para evitar condiciones de carrera o desastres en cascada.
*   **Agnóstico a la Terminal:** Configurado para usar `cmd.exe` en Windows con soporte para UTF-8 (`chcp 65001`).
*   **Feedback Loop:** Genera automáticamente un reporte en XML con los resultados de `stdout`, `stderr` y códigos de salida para que el LLM pueda corregir sus propios errores.
*   **Diff Visual Estilo GitHub:** Panel de control de cambios con diff coloreado, números de línea, headers de hunk y secciones de contexto colapsables.

---

## 🛠️ Requisitos previos

*   **Rust:** Canal `stable-x86_64-pc-windows-msvc`.
*   **Node.js:** v18 o superior.
*   **C++ Build Tools:** Herramientas de compilación de Visual Studio instaladas.

---

## 📦 Instalación y Desarrollo

1.  **Clonar y preparar:**
    ```bash
    npm install
    ```

2.  **Ejecutar en modo desarrollo:**
    ```bash
    npm run tauri dev
    ```

3.  **Ejecutar tests:**
    ```bash
    npm run test
    ```

---

## 📖 Protocolo de Etiquetas

El sistema reconoce las siguientes etiquetas:

### `<cmd>`
Ejecuta un comando en la terminal local.
```xml
<cmd>npm install lucide-preact</cmd>
```

### `<file>`
Escribe contenido directamente en un archivo del proyecto.
```xml
<file path="src/components/Button.tsx">
import { h } from 'preact';

export function Button() {
  return <button>Click me</button>;
}
</file>
```

### `<tree>`
Muestra la estructura de directorios a partir de la ruta indicada.
`<tree path="src/components" />`

---

## 🗺️ Hoja de Ruta (Próximamente)

*   **`<read path="...">`**: Permite al agente leer el contenido de archivos locales para ganar contexto sin necesidad de comandos de terminal.

---

## 🛡️ Seguridad
A diferencia de los agentes autónomos que se ejecutan en "modo Dios", **ControlVCode** requiere una revisión humana antes de cada ejecución. Cada comando es visible y editable antes de presionar el botón de "Ejecutar".

---

> **Nota:** Este proyecto nació para combatir la fatiga del "copiar y pegar" y para dar superpoderes locales a modelos de lenguaje remotos.
