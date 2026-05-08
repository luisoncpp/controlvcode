
import { describe, it, expect } from 'vitest';
import { ExecutionStore } from './ExecutionStore';
import { ActionNode } from '../types';

describe('ExecutionStore - Generación de Feedback XML', () => {
  
  it('inyecta metadatos correctamente y protege las salidas con CDATA', () => {
    const store = new ExecutionStore();
    
    // Simulamos nodos ya ejecutados
    store.nodes.value = [
      {
        id: '1',
        type: 'cmd',
        payload: 'echo hola',
        status: 'success',
        result: {
          stdout: 'hola',
          stderr: '',
          exitCode: 0,
          meta: { exit_code: 0 }
        }
      } as ActionNode,
      {
        id: '2',
        type: 'replace',
        payload: 'src/App.tsx',
        status: 'success',
        result: {
          stdout: 'Replaced 2 occurrence(s)',
          stderr: '',
          exitCode: 0,
          meta: { matches: 2 }
        }
      } as ActionNode
    ];

    const xml = store.feedbackPrompt.value;

    // Verificamos los atributos inyectados
    expect(xml).toContain('<result action="cmd" target="echo hola" exit_code="0" status="success">');
    expect(xml).toContain('<result action="replace" target="src/App.tsx" matches="2" status="success">');
    
    // Verificamos que el stdout se haya envuelto en CDATA
    expect(xml).toContain('<stdout><![CDATA[');
    // Usamos concatenación para no romper el parser XML de ControlVCode
    expect(xml).toContain('hola\n]' + ']>');
  });

  it('omite el stdout en operaciones de escritura de archivo (file) exitosas', () => {
    const store = new ExecutionStore();
    
    store.nodes.value = [
      {
        id: '1',
        type: 'file',
        payload: 'test.txt',
        status: 'success',
        result: {
          stdout: 'Contenido gigante que no debe aparecer',
          stderr: '',
          exitCode: 0,
          meta: { bytes: 1024 }
        }
      } as ActionNode
    ];

    const xml = store.feedbackPrompt.value;

    expect(xml).toContain('<result action="file" target="test.txt" bytes="1024" status="success">');
    // El gran ahorro de tokens:
    expect(xml).not.toContain('<stdout>');
    expect(xml).not.toContain('Contenido gigante que no debe aparecer');
  });

  it('incluye el stderr y marca el estado como error cuando el exitCode es distinto de 0', () => {
    const store = new ExecutionStore();
    
    store.nodes.value = [
      {
        id: '1',
        type: 'cmd',
        payload: 'comando_invalido',
        status: 'error',
        result: {
          stdout: '',
          stderr: 'command not found',
          exitCode: 1,
          meta: { exit_code: 1 }
        }
      } as ActionNode
    ];

    const xml = store.feedbackPrompt.value;

    expect(xml).toContain('status="error"');
    expect(xml).toContain('<stderr><![CDATA[');
    expect(xml).toContain('command not found');
  });
});
