import { invoke } from '@tauri-apps/api/core';

export interface ReadOptions {
  start?: number;
  end?: number;
  line?: number;
  count?: number;
}

/**
 * Formatea el contenido crudo con números de línea al estilo `cat -n`.
 * Las líneas se numeran a partir de `startLine` (por defecto 1).
 */
function formatWithLineNumbers(content: string, startLine: number = 1): string {
  const lines = content.split('\n');
  return lines
    .map((line, i) => {
      const num = (startLine + i).toString().padStart(5, ' ');
      return `${num}  ${line}`;
    })
    .join('\n');
}

/**
 * Ejecuta una acción de lectura.
 * - `path` es la ruta relativa al proyecto.
 * - `options` define el rango de líneas (start/end o line/count).
 */
export async function executeRead(
  path: string,
  options: ReadOptions = {}
): Promise<string> {
  // Resolver los parámetros de línea
  let start: number | undefined;
  let end: number | undefined;

  if (options.line !== undefined) {
    start = options.line;
    if (options.count !== undefined) {
      end = start + options.count - 1;
    } else {
      end = start; // una sola línea
    }
  } else {
    start = options.start;
    end = options.end;
  }

  // Invocar el comando Tauri
  const content: string = await invoke('read_file_with_line_numbers', {
    path,
    startLine: start ?? null,
    endLine: end ?? null,
  });

  // Si el contenido está vacío, devolver cadena vacía sin formatear
  if (!content) return '';

  // Formatear con números de línea a partir de la línea inicial real
  const firstLine = start ?? 1;
  return formatWithLineNumbers(content, firstLine);
}
