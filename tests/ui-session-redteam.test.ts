import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import * as ts from 'typescript';
import { expect, it } from 'vitest';
import { Store } from '../src/persistence/store';
import { initialState } from '../src/persistence/schema';
import { demoDataset } from '../src/market-data/demo';
import { ImportProvider, prepareRisk } from '../src/market-data/provider';
import { calculate, inputFromState } from '../src/snapshots/calculate';
import { seal, validateSeal } from '../src/snapshots/integrity';

// Node orchestration evidence, NOT a mounted React/native-browser test.
// Execute the actual App handlers; only React publications and asynchronous
// completion are controlled. Parsing is intentionally fail-closed if moved.
const source = readFileSync('src/ui/App.tsx', 'utf8');
const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate: (node: ts.Node) => boolean): ts.Node {
  let result: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (!result && predicate(node)) result = node;
    if (!result) ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!result) throw new Error('PRODUCTION_HANDLER_NOT_FOUND');
  return result;
}
type Callable = (...args: unknown[]) => unknown;
function closure(expression: string, environment: Record<string, unknown>): Callable {
  const javascript = ts.transpileModule(`(${expression})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText.replace(/^"use strict";\s*/, '');
  return new Function(...Object.keys(environment), `return ${javascript}`)(...Object.values(environment)) as Callable;
}
function handler(name: string, environment: Record<string, unknown>): Callable {
  return closure(find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast), environment);
}
function exitDemo(environment: Record<string, unknown>) {
  const button = find(node => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'button'
    && node.children.some(child => ts.isJsxText(child) && child.text.trim() === 'Afslut demo')) as ts.JsxElement;
  const attr = button.openingElement.attributes.properties.find(node => ts.isJsxAttribute(node) && node.name.getText(ast) === 'onClick') as ts.JsxAttribute;
  closure(((attr.initializer as ts.JsxExpression).expression!).getText(ast), environment)();
}
function held<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function setup() {
  const name = crypto.randomUUID(), store = await Store.open(name);
  const state = initialState(); state.capital = 4321;
  const stateRef = { current: await store.save(state, 0) };
  const demoRef = { current: null as typeof state | null };
  const context = { current: 0 }, filePending = { current: false };
  const queue = { current: Promise.resolve() as Promise<unknown> };
  const notices: unknown[] = [], selected: unknown[] = [], errors: unknown[] = [];
  const environment: Record<string, unknown> = {
    stateRef, demoRef, calculationContext: context, filePending, queue,
    calculating: { current: false }, committing: { current: false }, updateApproved: { current: false },
    initialState, demoDataset, ImportProvider, prepareRisk, validateSeal,
    setState: () => {}, setDemo: () => {}, setTab: () => {}, setFileBusy: () => {},
    setError: (value: unknown) => errors.push(value), setNotice: (value: unknown) => notices.push(value),
    setCurrent: (value: unknown) => selected.push(value), openDetails: () => {},
    persist: (next: typeof state) => {
      queue.current = queue.current.then(async () => { stateRef.current = await store.save(next, stateRef.current.revision); });
      return queue.current;
    },
  };
  environment.edit = handler('edit', environment);
  const imported = demoDataset(new Date().toISOString());
  imported.classification = 'user-supplied'; imported.provider = 'UNVERIFIED_MANUAL_FIXTURE';
  return { name, store, stateRef, demoRef, context, filePending, queue, environment, imported, notices, selected, errors };
}

it.each(['real', 'new-demo'] as const)('a held demo history import cannot write into the subsequent %s session', async target => {
  const h = await setup();
  try {
    handler('startDemo', h.environment)();
    const read = held<string>();
    const action = handler('fileAction', { ...h.environment, data: h.demoRef.current });
    const job = action({ size: 1, text: () => read.promise }, 'dataset');
    expect(h.filePending.current).toBe(true);
    exitDemo(h.environment);
    if (target === 'new-demo') handler('startDemo', h.environment)();
    h.notices.length = 0;
    read.resolve(JSON.stringify(h.imported)); await job; await h.queue.current;
    expect(h.notices).toEqual([]);
    expect(h.filePending.current).toBe(false);
    if (target === 'new-demo') expect(h.demoRef.current!.dataset!.provider).not.toBe(h.imported.provider);
    h.store.close();
    const reopened = await Store.open(h.name);
    try { expect((await reopened.load()).state).toStrictEqual(h.stateRef.current); expect((await reopened.load()).state.dataset).toBeNull(); }
    finally { reopened.close(); }
  } finally { h.store.close(); }
});

it.each([false, true])('same-session file history import still updates the correct owner (demo=%s)', async demo => {
  const h = await setup();
  try {
    if (demo) handler('startDemo', h.environment)();
    const action = handler('fileAction', { ...h.environment, data: h.demoRef.current ?? h.stateRef.current });
    await action({ size: 1, text: async () => JSON.stringify(h.imported) }, 'dataset'); await h.queue.current;
    expect(h.notices).toHaveLength(1);
    const stored = (await h.store.load()).state;
    expect(stored.capital).toBe(4321);
    expect(stored.dataset?.provider ?? null).toBe(demo ? null : 'UNVERIFIED_MANUAL_FIXTURE');
    if (demo) expect(h.demoRef.current!.dataset!.provider).toBe('UNVERIFIED_MANUAL_FIXTURE');
  } finally { h.store.close(); }
});

it('a demo snapshot validation held after file reading cannot select itself after demo exit', async () => {
  const h = await setup(), validation = held<void>(), entered = held<void>();
  try {
    const state = initialState(), now = new Date().toISOString();
    state.holdings.forEach(item => { item.priceDKK = 100; item.priceAsOf = now; });
    const sealed = await seal(calculate(inputFromState(state, now)));
    handler('startDemo', h.environment)();
    const action = handler('fileAction', { ...h.environment, data: h.demoRef.current,
      validateSeal: async (input: unknown) => { entered.resolve(); await validation.promise; return validateSeal(input); },
    });
    const job = action({ size: 1, text: async () => JSON.stringify(sealed) }, 'snapshot');
    await entered.promise;
    exitDemo(h.environment); h.selected.length = 0; h.notices.length = 0;
    validation.resolve(); await job;
    expect(h.selected).toEqual([]); expect(h.notices).toEqual([]);
  } finally { h.store.close(); }
});

it('a stale demo file-read failure cannot publish an error into the real session', async () => {
  const h = await setup(), read = held<string>();
  try {
    handler('startDemo', h.environment)();
    const action = handler('fileAction', { ...h.environment, data: h.demoRef.current });
    const job = action({ size: 1, text: async () => { await read.promise; throw new Error('OLD_DEMO_FILE_ERROR'); } }, 'dataset');
    exitDemo(h.environment); h.errors.length = 0;
    read.resolve(''); await job;
    expect(h.errors).toEqual([]); expect(h.filePending.current).toBe(false);
  } finally { h.store.close(); }
});

it.each(['another-client', 'approved-client', 'newer-waiting-worker'] as const)('controller change keeps only a real waiting update (%s)', async scenario => {
  const effect = find(node => ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
    && node.arguments[0].getText(ast).includes('navigator.serviceWorker')) as ts.CallExpression;
  const serviceEvents = new Map<string, Callable>(), appEvents = new Map<string, Callable>();
  const registration: { waiting: object | null; addEventListener: () => void } = { waiting: {}, addEventListener: () => {} };
  let update: typeof registration | null = null, reloads = 0;
  const environment = {
    navigator: { serviceWorker: { controller: {}, register: async () => registration,
      addEventListener: (name: string, callback: Callable) => serviceEvents.set(name, callback), removeEventListener: () => {},
    } },
    location: { reload: () => { reloads++; } }, setNotice: () => {},
    setUpdate: (value: typeof update | ((previous: typeof update) => typeof update)) => { update = typeof value === 'function' ? value(update) : value; },
    addEventListener: (name: string, callback: Callable) => appEvents.set(name, callback), removeEventListener: () => {},
  };
  closure(effect.arguments[0].getText(ast).replaceAll('import.meta.env.PROD', 'true').replaceAll('import.meta.env.BASE_URL', '"/EQUINOX/"'), environment)();
  await Promise.resolve();
  expect(update).toBe(registration);
  if (scenario === 'approved-client') appEvents.get('equinox-update')!();
  registration.waiting = scenario === 'newer-waiting-worker' ? {} : null;
  serviceEvents.get('controllerchange')!();
  expect(reloads).toBe(scenario === 'approved-client' ? 1 : 0);
  expect(update).toBe(scenario === 'another-client' ? null : registration);
});
