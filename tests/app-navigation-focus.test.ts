import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// Real navigation hooks/handlers; only menu presentation is replaced. Default
// focus restoration is asserted through its cancelable Radix callback, not a DOM.
let Navigation: ComponentType<{ onNavigate?: (destination: string) => void; onHelp?: (target: unknown) => void }>;
const bundleFile = resolve('work', `navigation-focus-${randomUUID()}.mjs`);
before(async () => {
  const moduleName = 'esbuild';
  const { build } = await import(moduleName);
  await build({ entryPoints: ['components/app-navigation.tsx'], outfile: bundleFile, bundle: true, platform: 'node', format: 'esm', external: ['react', 'react/jsx-runtime', 'lucide-react'], plugins: [{ name: 'menu-presentation', setup(builder: { onResolve: (options: object, callback: (args: { path: string }) => object) => void; onLoad: (options: object, callback: () => object) => void }) {
    builder.onResolve({ filter: /^@\/components\/ui\/dropdown-menu$/ }, args => ({ path: args.path, namespace: 'menu-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'menu-test' }, () => ({ contents: `import {createElement as h} from 'react';const W=name=>({children,...props})=>h('div',{'data-menu':name,...props},children);export const DropdownMenu=W('menu-root'),DropdownMenuTrigger=W('menu-trigger'),DropdownMenuContent=W('menu-content'),DropdownMenuGroup=W('menu-group'),DropdownMenuItem=W('menu-item'),DropdownMenuSeparator=W('menu-separator');`, loader: 'js', resolveDir: resolve('.') }));
  } }], logLevel: 'warning' });
  Navigation = (await import(pathToFileURL(bundleFile).href)).AppNavigation;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
after(async () => { await rm(bundleFile, { force: true }); });

function text(node: { children: unknown[] }): string { return node.children.map(child => typeof child === 'string' ? child : child && typeof child === 'object' && 'children' in child ? text(child as { children: unknown[] }) : '').join(''); }
async function opened(tree: ReactTestRenderer) { await act(async () => tree.root.findByProps({ 'data-menu': 'menu-root' }).props.onOpenChange(true)); }
async function closeFocus(tree: ReactTestRenderer) {
  await act(async () => tree.root.findByProps({ 'data-menu': 'menu-root' }).props.onOpenChange(false));
  let prevented = false;
  tree.root.findByProps({ 'data-menu': 'menu-content' }).props.onCloseAutoFocus({ preventDefault() { prevented = true; } });
  return prevented;
}
function event(change: Record<string, unknown> = {}) {
  let prevented = false;
  return { value: { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, preventDefault() { prevented = true; }, ...change }, prevented: () => prevented };
}

test('logo activation with a closed menu does not suppress the next Escape focus restoration', async () => {
  const destinations: string[] = []; let tree!: ReactTestRenderer;
  await act(async () => { tree = create(createElement(Navigation, { onNavigate: destination => destinations.push(destination) })); });
  try {
    const click = event();
    await act(async () => tree.root.findByProps({ className: 'braiz-navigation-brand' }).props.onClick(click.value));
    assert.equal(click.prevented(), true); assert.deepEqual(destinations, ['play']);
    assert.equal(tree.root.findByProps({ 'data-menu': 'menu-root' }).props.open, false);
    await opened(tree); assert.equal(await closeFocus(tree), false);
  } finally { await act(async () => tree.unmount()); }
});
test('menu navigation suppresses competing focus restoration only for its own closure', async () => {
  const destinations: string[] = []; let tree!: ReactTestRenderer;
  await act(async () => { tree = create(createElement(Navigation, { onNavigate: destination => destinations.push(destination) })); });
  try {
    await opened(tree); const click = event();
    await act(async () => tree.root.findAllByType('a').find(node => text(node) === 'Profil')!.props.onClick(click.value));
    assert.equal(click.prevented(), true); assert.deepEqual(destinations, ['profile']);
    assert.equal(await closeFocus(tree), true);
    await opened(tree); assert.equal(await closeFocus(tree), false);
  } finally { await act(async () => tree.unmount()); }
});
test('help selection preserves its return target and suppresses the competing menu restoration', async () => {
  const trigger = { focus() {} }, targets: unknown[] = []; let tree!: ReactTestRenderer;
  await act(async () => { tree = create(createElement(Navigation, { onHelp: target => targets.push(target) }), { createNodeMock: node => node.type === 'button' ? trigger : null }); });
  try {
    await opened(tree);
    await act(async () => tree.root.findAllByProps({ 'data-menu': 'menu-item' }).find(node => text(node) === 'Règles')!.props.onSelect());
    assert.deepEqual(targets, [trigger]); assert.equal(await closeFocus(tree), true);
    await opened(tree); assert.equal(await closeFocus(tree), false);
  } finally { await act(async () => tree.unmount()); }
});
test('modified links and native duel navigation keep their browser behavior without stale focus suppression', async () => {
  const destinations: string[] = []; let tree!: ReactTestRenderer;
  await act(async () => { tree = create(createElement(Navigation, { onNavigate: destination => destinations.push(destination) })); });
  try {
    for (const change of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { button: 1 }]) {
      for (const label of ['BRAIZ.', 'Profil']) {
        await opened(tree); const click = event(change);
        await act(async () => tree.root.findAllByType('a').find(node => text(node) === label)!.props.onClick(click.value));
        assert.equal(click.prevented(), false); assert.equal(await closeFocus(tree), false);
      }
    }
    await opened(tree); const duel = event();
    await act(async () => tree.root.findAllByType('a').find(node => text(node) === 'Duel')!.props.onClick(duel.value));
    assert.equal(duel.prevented(), false); assert.equal(await closeFocus(tree), false); assert.deepEqual(destinations, []);
  } finally { await act(async () => tree.unmount()); }
});
