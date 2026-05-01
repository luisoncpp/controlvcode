Tienes toda la razón. Un documento de diseño sin las firmas de las clases, los tipos de datos o las estructuras concretas se queda solo en buenas intenciones. Para que realmente sirva como mapa y te ayude a no perder la comprensión de tu código a medida que crece, necesitamos definir las fronteras y los contratos exactos.



Aquí tienes la expansión del documento de diseño, bajando al nivel de implementación con interfaces en TypeScript (Preact) y structs en Rust.

***

# Expansión Técnica: Estructuras y Clases

## 1. Contrato de Datos (Interfaces Compartidas Conceptualmente)
Aunque Rust y TypeScript viven en mundos separados, deben estar de acuerdo en la forma de los datos que viajan a través del IPC de Tauri.

**Estructura de Respuesta del Backend (El resultado de la terminal)**
Esta es la salida cruda que Rust le entregará a Preact.

```typescript
// TypeScript (Frontend)
interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

```rust
// Rust (Backend)
use serde::Serialize;

#[derive(Serialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}
```

## 2. Arquitectura del Frontend (TypeScript / Preact)

Para mantener la lógica separada de la vista (los componentes de Preact), definiremos dos clases/módulos principales: el `LLMParser` y el `QueueManager`.

### A. La Estructura del Nodo
Cada acción extraída del LLM se envuelve en este objeto. Su diseño permite que la aplicación sepa exactamente qué renderizar y en qué estado se encuentra.

```typescript
type ActionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';
type ActionType = 'cmd'; // Extensible en el futuro a 'file', 'patch', etc.

interface ActionNode {
  id: string;              // UUID para las keys de Preact
  type: ActionType;        
  payload: string;         // El comando bash a ejecutar
  status: ActionStatus;
  result: ExecutionResult | null;
}
```

### B. Clase: LLMParser
Se encarga exclusivamente de transformar texto plano en un arreglo de `ActionNode`. No tiene estado.

```typescript
export class LLMParser {
  /**
   * Extrae las etiquetas <cmd> y devuelve la cola inicial.
   */
  static parse(rawText: string): ActionNode[] {
    const nodes: ActionNode[] = [];
    const regex = /<cmd>([\s\S]*?)<\/cmd>/g;
    let match;

    while ((match = regex.exec(rawText)) !== null) {
      nodes.push({
        id: crypto.randomUUID(),
        type: 'cmd',
        payload: match[1].trim(),
        status: 'pending',
        result: null
      });
    }
    return nodes;
  }
}
```

### C. Clase (o Custom Hook): QueueManager
Maneja el estado de la cola secuencial. Si usas clases puras, esto se conectaría a tu estado de Preact. 

```typescript
export class QueueManager {
  nodes: ActionNode[];

  constructor(initialNodes: ActionNode[]) {
    this.nodes = initialNodes;
  }

  // Identifica cuál es el nodo que está bloqueando la cola (el primero no resuelto)
  getActiveNodeIndex(): number {
    return this.nodes.findIndex(n => n.status === 'pending' || n.status === 'error');
  }

  // Llama a Rust a través de Tauri
  async executeNode(index: number): Promise<void> {
    const node = this.nodes[index];
    if (node.status === 'running') return;

    node.status = 'running';
    // Aquí actualizarías el estado de Preact para mostrar el "loading"

    try {
      // Llamada IPC a Rust
      const result: ExecutionResult = await invoke('execute_bash_command', { 
        command: node.payload 
      });

      node.result = result;
      node.status = result.exitCode === 0 ? 'success' : 'error';
    } catch (e) {
      // Fallo catastrófico en IPC o Rust
      node.status = 'error';
      node.result = { stdout: '', stderr: String(e), exitCode: -1 };
    }
  }

  skipNode(index: number): void {
    this.nodes[index].status = 'skipped';
    // Esto automáticamente hace que getActiveNodeIndex() avance
  }

  // Genera el texto final para copiar de vuelta al chat del LLM
  generateFeedbackText(): string {
    return this.nodes
      .filter(n => n.result !== null)
      .map(n => `=== Salida de:\n${n.payload}\n===\n${n.result?.stderr || n.result?.stdout}`)
      .join('\n\n');
  }
}
```

## 3. Arquitectura del Backend (Rust)

El backend expone funciones puras sin estado. No hay una clase "Manager" en Rust porque Tauri se encarga de rutear las llamadas IPC hacia estas funciones.

### El Comando Tauri
Esta es la función que se registra en el `main.rs` de Tauri. Su firma debe coincidir con lo que el `QueueManager` espera.

```rust
use std::process::Command;

#[tauri::command]
pub fn execute_bash_command(command: &str) -> Result<ExecutionResult, String> {
    // Ejecuta bash -c "comando"
    let output = Command::new("bash")
        .arg("-c")
        .arg(command)
        .output()
        .map_err(|e| e.to_string())?; // Convierte el error de OS en un String para Tauri

    // Construye la estructura de respuesta
    Ok(ExecutionResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
```

Excelente decisión. Usar clases puras para la lógica de negocio (el "Modelo" y el "Controlador") y dejar a Preact exclusivamente como la "Vista" es una arquitectura fantástica. Desacopla completamente tu sistema: mañana podrías cambiar Preact por Vanilla JS o React sin tocar una sola línea de tu lógica de ejecución.

Para que las clases puras se comuniquen eficientemente con Preact sin tener que recurrir a *hooks* o a pasar callbacks de `setState` por todos lados, la mejor estrategia es utilizar **Preact Signals** (`@preact/signals`). Las *Signals* te permiten tener propiedades reactivas dentro de una clase pura; cuando la clase muta una *Signal*, cualquier componente de Preact que la esté leyendo se re-renderiza automáticamente.

Aquí tienes la propuesta de arquitectura del frontend basada en clases puras:

### 1. La Capa de Lógica (El "Store")

Toda la inteligencia de la aplicación vivirá aquí. No hay código de UI, solo estado y reglas de negocio.

```typescript
// store/ExecutionStore.ts
import { signal, Signal, computed } from "@preact/signals";
import { invoke } from "@tauri-apps/api/tauri";
import { LLMParser } from "./LLMParser"; // La clase estática de parseo que ya definimos

export class ExecutionStore {
  // Estado reactivo
  public rawInput: Signal<string>;
  public nodes: Signal<ActionNode[]>;

  constructor() {
    this.rawInput = signal("");
    this.nodes = signal([]);
  }

  // --- Acciones Derivadas (Getters reactivos) ---

  // Identifica el índice del nodo activo (el primero pendiente o en error)
  public get activeIndex(): number {
    return this.nodes.value.findIndex(n => n.status === 'pending' || n.status === 'error');
  }

  // --- Mutadores (Métodos de la clase) ---

  public processInput(text: string) {
    this.rawInput.value = text;
    // Sobrescribe la cola actual con los nuevos comandos parseados
    this.nodes.value = LLMParser.parse(text);
  }

  public async executeNode(index: number) {
    const nodes = [...this.nodes.value]; // Clonamos para inmutabilidad superficial
    const node = nodes[index];
    
    if (node.status === 'running') return;

    node.status = 'running';
    this.nodes.value = nodes; // Dispara el render (muestra estado de carga)

    try {
      // Llamada a Rust
      const result: ExecutionResult = await invoke('execute_bash_command', { 
        command: node.payload 
      });
      
      node.result = result;
      node.status = result.exitCode === 0 ? 'success' : 'error';
    } catch (e) {
      node.status = 'error';
      node.result = { stdout: '', stderr: String(e), exitCode: -1 };
    }

    this.nodes.value = [...nodes]; // Dispara el render final del nodo
  }

  public skipNode(index: number) {
    const nodes = [...this.nodes.value];
    nodes[index].status = 'skipped';
    this.nodes.value = nodes; // Dispara el render y avanza la cola
  }
}
```

### 2. La Capa de Vista (Componentes Preact)

La jerarquía de componentes será completamente tonta (*dumb components*). Su único trabajo es leer el estado de la clase `ExecutionStore` y llamar a sus métodos al hacer clic.

*   **`App`**: El contenedor raíz. Instancia la clase `ExecutionStore` (o la recibe) y distribuye la UI.
*   **`PromptInput`**: Un área de texto. Llama a `store.processInput()` cuando el usuario pega el texto.
*   **`QueueViewer`**: Renderiza la lista de nodos. Le pasa a cada hijo su índice, sus datos y si está bloqueado o no.
*   **`ActionCard`**: El componente visual individual. Aplica clases de Tailwind dependiendo de si su `status` es `pending`, `running`, `success` o `error`.

### 3. El Ensamblaje (Inyección)

Así es como se conecta la clase pura con la UI de Preact en el archivo principal:

```tsx
// app.tsx
import { ExecutionStore } from './store/ExecutionStore';
import { PromptInput } from './components/PromptInput';
import { QueueViewer } from './components/QueueViewer';

// Instanciamos nuestra clase pura una sola vez (Singleton o a nivel raíz)
const store = new ExecutionStore();

export function App() {
  return (
    <div className="flex h-screen bg-gray-900 text-white p-6 gap-6">
      {/* Panel Izquierdo: Entrada */}
      <div className="w-1/3 flex flex-col">
        <h2 className="text-xl font-bold mb-4">Input LLM</h2>
        <PromptInput store={store} />
      </div>

      {/* Panel Derecho: Cola de Ejecución */}
      <div className="w-2/3 flex flex-col overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Cola de Comandos</h2>
        <QueueViewer store={store} />
      </div>
    </div>
  );
}
```

```tsx
// components/QueueViewer.tsx
import { ExecutionStore } from '../store/ExecutionStore';
import { ActionCard } from './ActionCard';

interface Props {
  store: ExecutionStore;
}

export function QueueViewer({ store }: Props) {
  // Al leer store.nodes.value, Preact se suscribe automáticamente a los cambios
  const nodes = store.nodes.value;
  const activeIndex = store.activeIndex;

  return (
    <div className="flex flex-col gap-4">
      {nodes.map((node, index) => (
        <ActionCard 
          key={node.id} 
          node={node}
          isActive={index === activeIndex} // Lógica de bloqueo visual
          onExecute={() => store.executeNode(index)}
          onSkip={() => store.skipNode(index)}
        />
      ))}
    </div>
  );
}
```

Es un detalle crucial. Dado que en tus restricciones iniciales mencionaste que el **auto-pegar o auto-enviar queda descartado** para no infringir los términos de uso de los LLMs, la mejor estrategia para esta primera fase es que la aplicación ensamble el texto y te ofrezca un botón manual de **"Copiar al Portapapeles"**.

Para mantener la coherencia con tu diseño (que ahora usa etiquetas tipo XML para la entrada), la salida también debería formatearse con etiquetas. Así, cuando pegues el resultado de vuelta en ChatGPT o Claude, el LLM entenderá la estructura al instante sin que tengas que explicarle nada.

Aquí tienes cómo integrar este "Prompt de Salida" en la arquitectura de clases puras que definimos:

### 1. El Formato del Prompt de Salida
Si el LLM nos dio comandos en XML, le responderemos en XML. El formato generado debería verse así:

```xml
<execution_results>
  <result command="cargo init" status="success">
    <stdout>Creado paquete binario (aplicación) `test-app`</stdout>
  </result>
  <result command="npm install preact" status="error">
    <stderr>npm ERR! code ENOENT...</stderr>
  </result>
</execution_results>
```

### 2. Actualización de la Clase (El Store)
Usaremos la función `computed` de Preact Signals. Un valor `computed` se recalcula automáticamente y de forma eficiente solo cuando las variables de las que depende cambian (en este caso, la lista de nodos y sus resultados).

```typescript
// store/ExecutionStore.ts
import { signal, Signal, computed } from "@preact/signals";
// ... (importaciones anteriores)

export class ExecutionStore {
  public rawInput: Signal<string>;
  public nodes: Signal<ActionNode[]>;
  
  // Nuevo: Signal computada para el prompt de salida
  public feedbackPrompt: Signal<string>;

  constructor() {
    this.rawInput = signal("");
    this.nodes = signal([]);

    // Se actualiza sola cada vez que un nodo cambia de estado o recibe un resultado
    this.feedbackPrompt = computed(() => this.generateFeedback());
  }

  // ... (métodos get activeIndex, processInput, executeNode, skipNode)

  // Lógica privada para estructurar el XML de salida
  private generateFeedback(): string {
    const executedNodes = this.nodes.value.filter(n => n.result !== null);
    
    if (executedNodes.length === 0) return "";

    let xml = "<execution_results>\n";
    
    for (const node of executedNodes) {
      const { payload, result } = node;
      const status = result!.exitCode === 0 ? "success" : "error";
      
      xml += `  <result command="${payload}" status="${status}">\n`;
      if (result!.stdout) xml += `    <stdout>\n${result!.stdout}\n    </stdout>\n`;
      if (result!.stderr) xml += `    <stderr>\n${result!.stderr}\n    </stderr>\n`;
      xml += `  </result>\n`;
    }
    
    xml += "</execution_results>";
    return xml;
  }
}
```

### 3. El Componente Visual (FeedbackPanel)
Añadimos un nuevo componente a la interfaz que muestre este texto y maneje el copiado. Usaremos la API nativa del navegador `navigator.clipboard.writeText`, que está soportada perfectamente dentro de Tauri.

```tsx
// components/FeedbackPanel.tsx
import { useState } from 'preact/hooks';
import { ExecutionStore } from '../store/ExecutionStore';

interface Props {
  store: ExecutionStore;
}

export function FeedbackPanel({ store }: Props) {
  const [copied, setCopied] = useState(false);
  const promptText = store.feedbackPrompt.value;

  // Si no hay nada ejecutado, no mostramos el panel
  if (!promptText) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Resetea el texto del botón en 2s
    } catch (err) {
      console.error('Error al copiar: ', err);
    }
  };

  return (
    <div className="mt-6 border-t border-gray-700 pt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-gray-300">Prompt de Salida</h3>
        <button 
          onClick={handleCopy}
          className={`px-4 py-2 rounded font-bold transition-colors ${
            copied ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          {copied ? '¡Copiado!' : 'Copiar al Chat'}
        </button>
      </div>
      
      <pre className="bg-gray-950 p-4 rounded overflow-x-auto text-sm text-gray-400 font-mono">
        {promptText}
      </pre>
    </div>
  );
}
```

### 4. Integración en el Flujo
Este `FeedbackPanel` lo puedes colocar justo debajo del `QueueViewer` en tu archivo `app.tsx`. 

**El flujo queda así:**
1. Lees el comando en la app.
2. Le das a "Ejecutar".
3. La terminal corre y falla con un error.
4. El `feedbackPrompt` se recalcula en microsegundos y el `FeedbackPanel` aparece al fondo de tu app mostrando el XML con el error exacto.
5. Haces clic en "Copiar al Chat", regresas al navegador (Chrome/Firefox) y le haces `Ctrl+V` al LLM.

Con esto cierras el ciclo de ida y vuelta. Sigues manteniendo la máxima seguridad y control local (tú autorizas las ejecuciones y tú decides cuándo pegar la respuesta), pero el trabajo mecánico de formatear las salidas de la terminal desaparece por completo.

# Context

Para mantener la robustez y evitar que las cosas se vuelvan "mágicas" u oscuras (acorde a tu filosofía de comprenderlo todo), la mejor práctica en Preact/React no es usar el `useContext` crudo en cada componente, sino crear un **Custom Hook** estricto.

Aquí tienes cómo estructurar este acceso global paso a paso:

### 1. El Archivo del Contexto (`context/StoreContext.ts`)
Aquí creamos el contexto y un hook (`useStore`) que nos garantiza que la aplicación explote de inmediato con un error claro si intentamos renderizar un componente fuera del Provider. Esto es un salvavidas para cuando escribas tus pruebas automáticas.

```typescript
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { ExecutionStore } from '../store/ExecutionStore';

// El contexto inicia nulo por defecto
export const StoreContext = createContext<ExecutionStore | null>(null);

// Hook personalizado para consumir el store de forma segura
export function useStore(): ExecutionStore {
  const store = useContext(StoreContext);
  
  if (!store) {
    throw new Error("useStore debe ser usado dentro de un <StoreContext.Provider>");
  }
  
  return store;
}
```

### 2. Inyectar el Contexto Global (`app.tsx`)
En tu componente raíz, instancias la clase pura una única vez y envuelves toda la aplicación. A partir de este punto, la instancia está disponible globalmente para cualquier componente hijo.

```tsx
import { ExecutionStore } from './store/ExecutionStore';
import { StoreContext } from './context/StoreContext';
import { PromptInput } from './components/PromptInput';
import { QueueViewer } from './components/QueueViewer';
import { FeedbackPanel } from './components/FeedbackPanel';

// Instancia única (Singleton a nivel de raíz)
const store = new ExecutionStore();

export function App() {
  return (
    // Proveemos la instancia a todo el árbol
    <StoreContext.Provider value={store}>
      <div className="flex h-screen bg-gray-900 text-white p-6 gap-6">
        <div className="w-1/3 flex flex-col">
          <h2 className="text-xl font-bold mb-4">Input LLM</h2>
          {/* Ya no pasamos props */}
          <PromptInput />
        </div>

        <div className="w-2/3 flex flex-col overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Cola de Comandos</h2>
          <QueueViewer />
          <FeedbackPanel />
        </div>
      </div>
    </StoreContext.Provider>
  );
}
```

### 3. Consumir el Contexto (Ejemplo: `ActionCard.tsx`)
Cualquier componente, sin importar qué tan profundo esté en el árbol, simplemente llama a `useStore()`. Como estamos usando `@preact/signals` dentro de la clase pura, Preact es lo suficientemente inteligente para re-renderizar este componente **solo** si los valores de la *Signal* que lee cambian.

```tsx
import { useStore } from '../context/StoreContext';

// Ya no necesita recibir el store, solo sus datos específicos o su índice
interface Props {
  index: number;
}

export function ActionCard({ index }: Props) {
  // Consumo global
  const store = useStore();
  
  // Leemos del estado reactivo
  const node = store.nodes.value[index];
  const isActive = index === store.activeIndex;

  return (
    <div className={`p-4 border rounded ${isActive ? 'border-blue-500' : 'border-gray-700'}`}>
      <pre className="text-sm font-mono text-gray-300">{node.payload}</pre>
      
      {/* Controles */}
      <div className="mt-2 flex gap-2">
        <button 
          disabled={!isActive}
          onClick={() => store.executeNode(index)}
          className="bg-blue-600 px-3 py-1 rounded disabled:opacity-50"
        >
          Ejecutar
        </button>
        <button 
          disabled={!isActive}
          onClick={() => store.skipNode(index)}
          className="bg-gray-600 px-3 py-1 rounded disabled:opacity-50"
        >
          Omitir
        </button>
      </div>

      {/* Salida de la terminal */}
      {node.result && (
        <div className="mt-2 p-2 bg-black rounded text-xs font-mono">
          {node.result.stdout && <div className="text-green-400">{node.result.stdout}</div>}
          {node.result.stderr && <div className="text-red-400">{node.result.stderr}</div>}
        </div>
      )}
    </div>
  );
}
```

Con este patrón, la arquitectura queda sumamente limpia. Tu interfaz gráfica es solo un reflejo tonto del estado de tu clase pura `ExecutionStore`, y la comunicación con Rust está completamente aislada de la UI.

Ya tenemos el documento de diseño, las estructuras de datos, la capa lógica y la capa de vista definidas. ¿Te parece bien si pasamos a revisar cómo configurar el proyecto base con Tauri CLI para empezar a implementar el backend en Rust?