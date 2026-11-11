import { describe, expect, it } from 'vitest';
import { createScriptedInterviewer, detectKind, type Turn } from './habitFlow';

const ctx = { today: '2026-11-11' };

/** Answer each question in turn; returns every turn including the first. */
async function run(answers: string[]) {
  const iv = createScriptedInterviewer(ctx);
  const turns: Turn[] = [await iv.start()];
  for (const a of answers) turns.push(await iv.answer(a));
  return { iv, turns, last: turns[turns.length - 1] };
}

describe('habit flow', () => {
  it('detects the kind of habit from its name', () => {
    expect(detectKind('Gym')).toBe('exercise');
    expect(detectKind('Go for a run')).toBe('exercise');
    expect(detectKind('Read a page')).toBe('reading');
    expect(detectKind('Wake up early')).toBe('wake');
    expect(detectKind('No sugar')).toBe('avoid');
    expect(detectKind('Quit smoking')).toBe('avoid');
    expect(detectKind('Meditate')).toBe('mindful');
    expect(detectKind('Practice guitar')).toBe('general');
  });

  it('daily habit: name → schedule → minimum → rest days → start', async () => {
    const { last } = await run(['Read a page', 'daily', 'Read one page', '2', '2026-11-11']);
    expect(last.input).toBeNull();
    expect(last.result).toEqual({
      name: 'Read a page',
      schedule_type: 'daily',
      weekly_target: null,
      minimum_version: 'Read one page',
      rest_days_per_month: 2,
      start_date: '2026-11-11',
    });
  });

  it('weekly habit asks for a target and skips rest days', async () => {
    const { turns, last } = await run(['Gym', 'weekly', '4', 'Put on gym clothes and shoes', '2026-11-12']);
    // Gym is a seed habit: weekly and 4× are suggested
    const schedule = turns[1].input;
    expect(schedule?.kind === 'choice' && schedule.options.find((o) => o.suggested)?.value).toBe('weekly');
    const target = turns[2].input;
    expect(target?.kind === 'choice' && target.options.find((o) => o.suggested)?.value).toBe('4');
    expect(turns.some((t) => t.messages.some((m) => /rest days/i.test(m) && /month/.test(m)))).toBe(false);
    expect(last.result).toMatchObject({ schedule_type: 'weekly', weekly_target: 4, rest_days_per_month: 0, start_date: '2026-11-12' });
  });

  it('wake-up habit asks for the time and uses it in the minimum suggestion', async () => {
    const { turns } = await run(['Wake up early', '06:30']);
    const min = turns[2].input;
    expect(min?.kind).toBe('text');
    expect(min?.kind === 'text' && min.suggestions[0]).toBe('Out of bed by 6:30am');
    // wake-up habits are daily without asking
    expect(turns[1].messages.join(' ')).toMatch(/what time/i);
  });

  it('a habit to avoid skips the schedule and asks what counts as a win', async () => {
    const { turns, last } = await run(['No sugar', '', '0', '2026-11-11']);
    expect(turns[1].messages.join(' ')).toMatch(/win/i);
    expect(last.result).toMatchObject({ name: 'No sugar', schedule_type: 'daily', minimum_version: null, rest_days_per_month: 0 });
  });

  it('undo steps back one answer and can change the path', async () => {
    const { iv } = await run(['Practice guitar', 'weekly']);
    const back = await iv.undo();
    expect(back.input?.kind).toBe('choice'); // schedule asked again
    const daily = await iv.answer('daily');
    expect(daily.messages.join(' ')).toMatch(/tiniest version/i);
  });

  it('rejects empty names and out-of-range answers', async () => {
    const iv = createScriptedInterviewer(ctx);
    await iv.start();
    const again = await iv.answer('   ');
    expect(again.input?.kind).toBe('text');
    expect(again.messages[0]).toMatch(/try again/i);
  });
});
