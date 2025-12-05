import process from 'process';

const globalScope = globalThis as typeof globalThis & { process?: typeof process };

if (!globalScope.process) {
  globalScope.process = process;
}
