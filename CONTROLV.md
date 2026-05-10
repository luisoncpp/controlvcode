Este proyecto es **ControlVCode**, se trata de un puente de ejecución local diseñado para eliminar la fricción entre las respuestas de un LLM (Large Language Model) y tu entorno de desarrollo. Permite parsear, autorizar y ejecutar comandos de terminal y manipulaciones de archivos directamente desde una interfaz de escritorio segura.

El proyecto utiliza una arquitectura de **"Humano en el bucle" (Human-in-the-loop)** para garantizar la seguridad mientras se acelera el flujo de trabajo:

*   **Frontend:** Preact + TypeScript + Tailwind CSS v4. Utiliza `@preact/signals` para una reactividad de alto rendimiento y una gestión de estado desacoplada de la UI.
*   **Backend:** Rust (Tauri v2). Gestiona la comunicación segura con el sistema operativo y la ejecución de procesos hijos.
*   **Protocolo:** Comunicación mediante etiquetas XML personalizadas para facilitar el parseo y la retroalimentación.

El usuario esta misma aplicación para interactuar contigo. Las reglas de interacción están en el archivo de prompt.md

@docs/prompt.md
@docs/GUIDELINES.md
@docs/architecture/README.md