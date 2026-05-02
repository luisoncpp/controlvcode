import { skipWhitespace, parseAttributeName } from './textUtils';

/** Consume el signo `=` y los espacios opcionales alrededor. Retorna el índice donde comienza el valor. */
function consumeEqualsAndSpaces(text: string, start: number): number | null {
  let i = skipWhitespace(text, start);
  if (i >= text.length || text[i] !== '=') return null;
  i++;
  return skipWhitespace(text, i);
}

/** Lee un valor de atributo entre comillas (simple o doble). */
function parseQuotedAttributeValue(
  text: string,
  quoteIndex: number,
): { value: string; nextIndex: number } | null {
  const quoteChar = text[quoteIndex];
  if (quoteChar !== '"' && quoteChar !== "'") return null;

  const valStart = quoteIndex + 1;
  let i = valStart;
  while (i < text.length && text[i] !== quoteChar) i++;
  if (i >= text.length) return null; // unterminated string

  return { value: text.substring(valStart, i), nextIndex: i + 1 };
}

/** Parsea los atributos XML a partir de `start`. */
export function parseAttributesAt(text: string, start: number): { attrs: Record<string, string>; nextIndex: number } {
  const attrs: Record<string, string> = {};
  let i = start;

  while (i < text.length && text[i] !== '>' && text[i] !== '/') {
    i = skipWhitespace(text, i);
    if (i >= text.length || text[i] === '>' || text[i] === '/') break;

    // nombre del atributo
    const { name: attrName, nextIndex: afterName } = parseAttributeName(text, i);
    i = afterName;
    if (attrName.length === 0) break;

    // '=' y valor
    const valueStart = consumeEqualsAndSpaces(text, i);
    if (valueStart === null) {
      // atributo sin valor, simplemente continuamos
      continue;
    }
    const valueResult = parseQuotedAttributeValue(text, valueStart);
    if (valueResult) {
      attrs[attrName] = valueResult.value;
      i = valueResult.nextIndex;
    } else {
      // no se pudo leer valor, seguir adelante
      i = valueStart;
    }
  }

  return { attrs, nextIndex: i };
}
