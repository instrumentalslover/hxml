import { performance } from 'node:perf_hooks';
import { parse, validate, emit, compile } from '../dist/index.js';

const ELEMENT_COUNT = 10_000;

function makeLargeDocument(count) {
  let out = '<!DOCTYPE html><html><body><section id="bulk">';
  for (let i = 0; i < count; i++) {
    out += `<data:item xmlns:data="urn:bench" data-id="${i}"><data:name>Item ${i}</data:name><p>Value ${i & 15}</p></data:item>`;
  }
  out += '</section></body></html>';
  return out;
}

function runCase(label, fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const ms = Number((end - start).toFixed(2));
  return { label, ms, result };
}

const source = makeLargeDocument(ELEMENT_COUNT);
console.log(`HXML benchmark on ${ELEMENT_COUNT.toLocaleString()} XML elements`);
console.log(`Source size: ${(source.length / 1024).toFixed(1)} KiB`);

const parseResult = runCase('parse()', () => parse(source));
const validateResult = runCase('validate(ast)', () => validate(parseResult.result.ast));
const emitResult = runCase('emit(ast)', () => emit(parseResult.result.ast, { mode: 'custom-elements' }));
const compileResult = runCase('compile()', () => compile(source, { emit: { mode: 'custom-elements' } }));

const diagnostics = compileResult.result.diagnostics;
console.log('');
console.table([
  { step: parseResult.label, ms: parseResult.ms },
  { step: validateResult.label, ms: validateResult.ms },
  { step: emitResult.label, ms: emitResult.ms },
  { step: compileResult.label, ms: compileResult.ms },
]);
console.log(`Diagnostics: ${diagnostics.length}`);
console.log(`Output size: ${(compileResult.result.html.length / 1024).toFixed(1)} KiB`);
