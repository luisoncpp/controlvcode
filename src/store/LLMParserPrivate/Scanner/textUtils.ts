import type { Range } from '../types';

/**
 * Si el índice actual está dentro de un rango protegido (bloque de backticks),
 * salta hasta el final de dicho rango para evitar escanear su interior.
 */
export function advanceIndexPastProtectedRanges(index: number, ranges: Range[]): number {
  for (const r of ranges) {
    if (index >= r.start && index < r.end) return r.end;
  }
  return index;
}

/** Salta espacios en blanco a partir de `start` y retorna el nuevo índice. */
export function skipWhitespace(text: string, start: number): number {
  let i = start;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) {
    i++;
  }
  return i;
}

/** Lee el nombre de la etiqueta XML comenzando en `start`. */
export function parseTagNameAt(text: string, start: number): { name: string; nextIndex: number } {
  let i = start;
  while (i < text.length && text[i] !== ' ' && text[i] !== '>' && text[i] !== '/' && text[i] !== '\t' && text[i] !== '\n' && text[i] !== '\r') {
    i++;
  }
  return { name: text.substring(start, i), nextIndex: i };
}

/** Lee el nombre de un atributo (hasta `=`, espacio, `>` o `/`). */
export function parseAttributeName(text: string, start: number): { name: string; nextIndex: number } {
  let i = start;
  while (i < text.length && text[i] !== '=' && text[i] !== ' ' && text[i] !== '>' && text[i] !== '/' && text[i] !== '\t' && text[i] !== '\n' && text[i] !== '\r') {
    i++;
  }
  return { name: text.substring(start, i), nextIndex: i };
}
