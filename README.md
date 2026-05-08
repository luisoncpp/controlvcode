
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

### Parseo y Ejecución
*   **Parser Inteligente:** Detecta automáticamente bloques `<cmd>`, `<file>`, `<tree>`, `<read>` y `<replace>` dentro de cualquier texto pegado. Ignora etiquetas mencionadas dentro de backticks inline (`` `...` ``) para evitar ejecuciones accidentales.
*   **AST Recursivo:** Soporta etiquetas anidadas nativamente, permitiendo estructuras complejas como el formato anidado de `<replace>`.
*   **Bloques CDATA:** Soporta `<![CDATA[ ... ]]>` para escribir archivos completos (como JSX o HTML) sin necesidad de escapar `<` ni `>`(con la restricción de que está prohibido incluir `]]>` dentro del `CDATA`).
*   **Escritura de Archivos:** Soporta la etiqueta `<file>` para crear o sobrescribir archivos directamente desde la respuesta del LLM.
*   **Lectura de Archivos:** Soporta la etiqueta `<read>` para leer archivos con numeración de líneas, incluyendo rangos (`start`, `end`, `line`, `count`).
*   **Reemplazo Quirúrgico:** Soporta la etiqueta `<replace>` para sustituir fragmentos de texto en archivos existentes (primera ocurrencia o todas). Ahora soporta anidación de tags `<old>` y `<new>`.
*   **Exploración de Directorios:** Soporta la etiqueta `<tree>` para mostrar la estructura de carpetas del proyecto, ignorando directorios irrelevantes (`node_modules`, `.git`, `target`, etc.).

### Cola y Feedback
*   **Cola Secuencial:** Los comandos se organizan en tarjetas de acción. Solo se permite la ejecución del comando actual para evitar condiciones de carrera o desastres en cascada. Las tarjetas completadas desaparecen automáticamente.
*   **Autocopiado:** Toggle para copiar automáticamente el XML de feedback al portapapeles tras cada ejecución.
*   **Feedback Loop:** Genera automáticamente un reporte en XML con los resultados de `stdout`, `stderr` y códigos de salida para que el LLM pueda corregir sus propios errores.

### Control de Cambios (Compare-TDD)
*   **Snapshot Automático:** Toma una instantánea Git antes de ejecutar la primera acción de cada tanda.
*   **Diff Visual:** Al finalizar la cola, muestra un diff unificado de todos los archivos modificados.
*   **Revertir:** Restaura los archivos modificados al estado de la instantánea (sin borrar archivos nuevos).

### Composición de Prompts
*   **PromptBuilder:** Compositor de prompts con autocompletado de archivos. Escribe `@` seguido del nombre de un archivo para adjuntarlo al prompt. Genera y copia el prompt completo al portapapeles con un clic.

### Interfaz
*   **Siempre Visible:** La ventana se mantiene "always on top" para evitar Alt+Tab constantes.
*   **Selector de Proyecto:** Diálogo nativo para cambiar la carpeta raíz del proyecto. Todos los comandos y archivos operan relativos a ella.
*   **Botón Pegar:** Lee el contenido del portapapeles y lo pega directamente en el área de entrada.
*   **Agnóstico a la Terminal:** Configurado para usar `cmd.exe` en Windows con soporte para UTF-8 (`chcp 65001`).

---

## 🛠️ Requisitos previos

*   **Rust:** Canal `stable-x86_64-pc-windows-msvc`.
*   **Node.js:** v18 o superior.
*   **C++ Build Tools:** Herramientas de compilación de Visual Studio instaladas.
*   **Git:** Requerido para la funcionalidad de Control de Cambios.

---

## 📦 Instalación y Desarrollo

1.  **Clonar y preparar:**
    ```bash
    npm install
    ```

2.  **Ejecutar en modo desarrollo (con vigilancia):**
    ```bash
    npm run tauri dev
    ```

3.  **Ejecutar en modo desarrollo (sin reinicios automáticos):**
    ```bash
    npm run tauri:dev
    ```

4.  **Ejecutar tests:**
    ```bash
    npm test
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
<file path="texto.txt">
Hola mundo!
</file>
```

Lo que está dentro de las etiquetas sustituye las secuencias de escape `&lt;`, `&gt;`, `&amp;` y `&quot;`.

Se recomienda usar bloques `CDATA` para escribir código, así es posible escribir tags en el código sin confundir al parser de XML, incluso permiten escribir `</file>` adentro de un bloque `<file>` y sin sustituir secuencias de escape:

```xml
<file path="src/components/Button.tsx">
<![CDATA[
import { h } from 'preact';

export function Label() {
  return "</file>";
}
export function MathHTML() {
    return "2 &lt; 5";
}
]]>
</file>
```

### `<tree>`
Muestra la estructura de directorios a partir de la ruta indicada.
```xml
<tree path="src/components" />
```

### `<replace>`
Reemplaza fragmentos de texto en archivos existentes.

**Formato anidado con CDATA (Recomendado):** Permite reemplazar textos complejos sin preocuparse por comillas o caracteres XML especiales.
```xml
<replace path="src/index.html" occurrence="first">
<old><![CDATA[<div>Viejo</div>]]></old>
<new><![CDATA[<div>Nuevo & Mejor</div>]]></new>
</replace>
```

**Formato con atributos (Legacy):**
```xml
<replace path="archivo.txt" old="texto" new="nuevo" occurrence="all" />
```

**TIP**: Lo que coloques entre `<old>...</old>` trata de que no tengan espacios al inicio ni al final, porque es probable que no los cuentes bien.

---

### `<grep>`
Busca un patrón regex en los archivos del proyecto.
```xml
<grep path="src" pattern="TODO" glob="*.ts" ignore_case="true" />
```
Para patrones con caracteres especiales o multilínea, usa el formato anidado con `<pattern>...</pattern>` y CDATA (igual que `<replace>`).

---

## 🗺️ Hoja de Ruta

* Archivos embebidos en adjuntos
* Soporte para PowerShell
* Soporte para Bash(requerirá archivo de configuración)
* Ver archivos nuevos en el diff.
* Soporte para configurar permisos (requerirá archivo de configuración)
* Cambiar el layout actual por algo más cómodo.

---

## 🛡️ Seguridad
A diferencia de los agentes autónomos que se ejecutan en "modo Dios", **ControlVCode** requiere una revisión humana antes de cada ejecución. Cada comando es visible y editable antes de presionar el botón de "Ejecutar".

El Control de Cambios permite revertir cualquier modificación realizada por el LLM, devolviendo el proyecto al estado anterior a la ejecución.

---

> **Nota:** Este proyecto nació para combatir la fatiga del "copiar y pegar" y para dar superpoderes locales a modelos de lenguaje remotos.
