// Polyfill completo para process, incluyendo nextTick que es requerido por simple-peer
import processImport from 'process';

// Crear una copia mutable de process
const process = processImport as typeof processImport & {
  nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void;
};

// Implementar process.nextTick usando queueMicrotask (más rápido que setTimeout)
process.nextTick = function (callback: (...args: unknown[]) => void, ...args: unknown[]) {
  queueMicrotask(() => {
    try {
      callback(...args);
    } catch (err) {
      console.error('[process.nextTick] Error:', err);
    }
  });
};

// Asegurar que process.env existe
if (!process.env) {
  process.env = {};
}

// Hacer process global INMEDIATAMENTE
const globalScope = globalThis as typeof globalThis & { 
  process?: typeof process;
};

globalScope.process = process;

// Log para verificar que se cargó
console.log('[Polyfills] process.nextTick disponible:', typeof process.nextTick === 'function');

// Exportar process configurado
export default process;
