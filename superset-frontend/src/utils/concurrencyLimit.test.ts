import { createConcurrencyLimiter } from './concurrencyLimit';

const sleep = (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

test('runs no more than `limit` tasks at the same time', async () => {
  const limit = createConcurrencyLimiter(2);
  let inFlight = 0;
  let peak = 0;

  const task = () =>
    limit(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await sleep(5);
      inFlight -= 1;
      return 'done';
    });

  await Promise.all([task(), task(), task(), task(), task()]);

  expect(peak).toBe(2);
});

test('starts a queued task as soon as any slot frees, not when the batch ends', async () => {
  const limit = createConcurrencyLimiter(2);
  const events: string[] = [];

  const long = limit(async () => {
    events.push('long:start');
    await sleep(60);
    events.push('long:end');
  });
  const short = limit(async () => {
    events.push('short:start');
    await sleep(5);
    events.push('short:end');
  });
  const queued = limit(async () => {
    events.push('queued:start');
  });

  await Promise.all([long, short, queued]);

  expect(events.indexOf('queued:start')).toBeGreaterThan(
    events.indexOf('short:end'),
  );
  expect(events.indexOf('queued:start')).toBeLessThan(
    events.indexOf('long:end'),
  );
});

test('releases the slot when a task rejects', async () => {
  const limit = createConcurrencyLimiter(1);

  await expect(limit(() => Promise.reject(new Error('boom')))).rejects.toThrow(
    'boom',
  );

  // A chart erroring must not wedge the queue for every chart behind it.
  await expect(limit(async () => 'ran')).resolves.toBe('ran');
});

test('rejects and frees the slot when a queued task throws synchronously', async () => {
  const limit = createConcurrencyLimiter(1);

  const first = limit(async () => {
    await sleep(5);
    return 'first';
  });
  const throwing = limit((() => {
    throw new Error('sync boom');
  }) as () => Promise<string>);

  await expect(first).resolves.toBe('first');
  await expect(throwing).rejects.toThrow('sync boom');
  await expect(limit(async () => 'ran')).resolves.toBe('ran');
});

test('runs everything without limiting when the limit is not positive', async () => {
  const limit = createConcurrencyLimiter(0);
  let inFlight = 0;
  let peak = 0;

  const task = () =>
    limit(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await sleep(5);
      inFlight -= 1;
      return 'done';
    });

  await Promise.all([task(), task(), task()]);

  expect(peak).toBe(3);
});
