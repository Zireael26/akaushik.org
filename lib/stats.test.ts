import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCloudflareContext = vi.fn();

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: (...args: unknown[]) => getCloudflareContext(...args),
}));

const { getStats, readWorkerStatsKv } = await import('./stats');

const LIVE = JSON.stringify({
  generatedAt: new Date().toISOString(),
  username: 'Zireael26',
  window: 'last-365-days',
  includesPrivate: true,
  totalContributions: 13012,
  weeks: [1, 2, 3],
  repos: [
    {
      name: 'neev',
      label: 'Neev',
      url: 'https://github.com/msme-neev/neev',
      public: false,
      commits12mo: 10,
      lastCommit: '2026-08-12T02:28:30Z',
    },
  ],
});

describe('readWorkerStatsKv', () => {
  beforeEach(() => {
    getCloudflareContext.mockReset();
  });

  it('returns null when OpenNext has no Cloudflare context', async () => {
    getCloudflareContext.mockRejectedValue(new Error('no context'));
    expect(await readWorkerStatsKv()).toBeNull();
  });

  it('returns the STATS_KV binding from the Worker env', async () => {
    const kv = { get: async () => LIVE };
    getCloudflareContext.mockResolvedValue({ env: { STATS_KV: kv } });
    expect(await readWorkerStatsKv()).toBe(kv);
  });

  it('returns null when the binding is absent from env', async () => {
    getCloudflareContext.mockResolvedValue({ env: {} });
    expect(await readWorkerStatsKv()).toBeNull();
  });
});

describe('getStats', () => {
  beforeEach(() => {
    getCloudflareContext.mockReset();
  });

  it('serves a live KV snapshot when the binding is present', async () => {
    getCloudflareContext.mockResolvedValue({
      env: { STATS_KV: { get: async () => LIVE } },
    });
    const view = await getStats();
    expect(view.degraded).toBe(false);
    expect(view.reason).toBe('live');
    expect(view.stats.totalContributions).toBe(13012);
  });

  it('falls through to the checked-in snapshot when context is missing', async () => {
    getCloudflareContext.mockRejectedValue(new Error('no context'));
    const view = await getStats();
    expect(view.degraded).toBe(true);
    expect(view.stats.generatedAt).toBe('2026-08-13T05:50:08.537Z');
  });
});
