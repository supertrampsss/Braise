import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, StrictMode } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { CalendarReminderControl } from '../components/calendar-reminder';
import { CALENDAR_REMINDER_KEY, createCalendarReminder } from '../lib/calendar-reminder';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const content = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : content(child)).join('');

async function mount(stored: string | null, diagnostic: string | null = null) {
  const reads: string[] = [], writes: string[] = [];
  const timers = new Map<number, () => void>();
  let nextTimer = 0;
  Object.assign(globalThis, { window: {
    localStorage: {
      getItem(key: string) { reads.push(key); return key === CALENDAR_REMINDER_KEY ? stored : diagnostic; },
      setItem(key: string) { writes.push(key); },
    },
    setTimeout(callback: () => void) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id: number) { timers.delete(id); },
    addEventListener() {}, removeEventListener() {},
  }});
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(createElement(StrictMode, null, createElement(CalendarReminderControl))); });
  await act(async () => { const queued = [...timers.values()]; timers.clear(); queued.forEach(callback => callback()); });
  return { tree, reads, writes };
}

test('a voluntary reminder stays available with no history, a rolling history or unavailable diagnostics', async () => {
  const rolling = JSON.stringify({ version: 1, events: Array.from({ length: 100 }, () => ({ type: 'guessAccepted', context: 'daily', occurredAt: '2026-10-29T12:00:00.000Z' })) });
  for (const diagnostic of [null, rolling, '{invalid']) {
    const { tree, reads, writes } = await mount(null, diagnostic);
    try {
      assert.equal(content(tree.root.findByType('summary')), 'Rappel quotidien');
      assert.equal(tree.root.findByType('details').props.open, undefined);
      assert.equal(tree.root.findAll(node => node.type === 'button' && content(node) === 'Télécharger le rappel (.ics)').length, 1);
      assert.ok(tree.root.findByProps({ type: 'date' }).props.value);
      assert.ok(reads.every(key => key === CALENDAR_REMINDER_KEY));
      assert.deepEqual(writes, []);
    } finally { await act(async () => tree.unmount()); }
  }
});

test('restoring an existing reminder neither replaces nor reactivates it', async () => {
  const reminder = createCalendarReminder({ startDate: '2026-10-30', time: '19:00', timeZone: 'Europe/Paris', days: 3 }, 'existing', new Date('2026-10-29T12:00:00Z'));
  for (const cancelled of [false, true]) {
    const raw = JSON.stringify({ ...reminder, cancelled });
    const { tree, writes } = await mount(raw);
    try {
      assert.match(content(tree.root), cancelled ? /Arrêté dans BRAIZ/ : /Préparé ; ajout au calendrier non vérifié/);
      assert.equal(tree.root.findAll(node => node.type === 'button' && content(node) === 'Télécharger le rappel (.ics)').length, Number(cancelled));
      assert.deepEqual(writes, []);
    } finally { await act(async () => tree.unmount()); }
  }
});

test('incompatible reminder storage remains untouched and does not expose a creation action', async () => {
  const { tree, writes } = await mount('{"version":99}');
  try {
    assert.match(content(tree.root), /création est indisponible/);
    assert.equal(tree.root.findAllByType('button').length, 0);
    assert.deepEqual(writes, []);
  } finally { await act(async () => tree.unmount()); }
});
