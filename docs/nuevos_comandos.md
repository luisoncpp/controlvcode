## 1. La Etiqueta `<file>` (El Brazo Ejecutor)
Esta es la que ya tenemos en el radar. Su función es la **escritura y creación** de código sin que tengas que tocar el teclado.

*   **Propósito:** Permitir que el agente genere archivos completos, actualice componentes de Preact o escriba lógica en Rust directamente en tu carpeta de proyecto.
*   **Funcionamiento:** 
    *   El parser detectará `<file path="src/components/NuevoComponente.tsx">...</file>`.
    *   El backend de Rust usará `std::fs::create_dir_all` (para las carpetas) y `std::fs::write` (para el contenido).
*   **Por qué te va a gustar:** Elimina el 90% del "trabajo de oficina" del programador. Podrás decirle al LLM: "Refactoriza el ExecutionStore para usar persistencia" y él simplemente te mandará el bloque `<file>` que sobrescribirá el anterior.

---

## 2. La Etiqueta `<read>` o `<context>` (Los Ojos del Agente)
Esta es la que probablemente te gustó o la que necesitas para que el sistema sea bidireccional. Un agente no puede arreglar código que no puede ver.

*   **Propósito:** Permitir que el agente pida "permiso para leer" un archivo específico de tu disco duro.
*   **Funcionamiento:** 
    *   El agente responde: "Para ayudarte con el error de tipos, necesito ver la definición. <read path="src/types.ts" />".
    *   Tu aplicación lee el archivo en Rust y lo mete automáticamente en el próximo bloque de **Feedback XML** que le envíes al agente.
*   **Por qué es clave:** Evita que tengas que estar copiando y pegando tus archivos actuales en el chat cada vez que pides un cambio. El agente se vuelve autónomo para "explorar" tu codebase.

---

## 3. Bonus: La Etiqueta `<tree>` (El Mapa del Tesoro)
Como estás trabajando en proyectos con muchas piezas (como el navegador de archivos de Discord o el Cenotafio), esta etiqueta es utilísima para la orientación.

*   **Propósito:** Obtener la estructura de carpetas de una ruta dada.
*   **Funcionamiento:** Rust ejecuta un comando similar a `dir /s /b` o una función recursiva de directorios y devuelve la lista de archivos al LLM.
*   **Utilidad:** Antes de escribir un archivo, el agente puede preguntar: `<tree path="src" />` para asegurarse de que no está duplicando componentes o usando rutas equivocadas.

---

### Resumen del Flujo de Trabajo Ideal
1.  **Exploración:** El agente pide el `<tree>` del proyecto.
2.  **Comprensión:** El agente pide `<read>` de los archivos que quiere modificar.
3.  **Ejecución:** El agente envía los `<file>` con las mejoras y los `<cmd>` para compilar o probar.
