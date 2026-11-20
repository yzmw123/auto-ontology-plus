// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from './route';

const db = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() }));
vi.mock('@/auth/resolve-user', () => ({
	resolveUser: async () => ({ id: 'caller', role: 'admin' }),
}));
vi.mock('@/lib/prisma', () => ({ getPrisma: () => ({ conversationAnalytics: db }) }));

const list = (query: Record<string, string> = {}) =>
	GET(new Request('http://localhost/api/analytics?' + new URLSearchParams(query)));

beforeEach(() => {
	vi.clearAllMocks();
	db.count.mockResolvedValue(12);
	db.findMany.mockResolvedValue([]);
	db.groupBy.mockResolvedValue([{ source: 'app' }, { source: 'reporting' }]);
});

it('applies identical filters to the count, page and export, including historical dates and literal search text', async () => {
	const filters = {
		from: '2024-01-02T00:00:00+08:00',
		before: '2024-01-03T00:00:00+08:00',
		username: ' A_B% ',
		source: 'reporting',
	};
	const match = { contains: 'A\\_B\\%', mode: 'insensitive' };
	const where = {
		question_timestamp: { gte: new Date(filters.from), lt: new Date(filters.before) },
		user: { OR: [{ name: match }, { email: match }] },
		source: 'reporting',
	};
	expect(
		await (await list({ ...filters, skip: '10', limit: '10', includeSources: 'true' })).json(),
	).toEqual({ data: [], total: 12, sources: ['app', 'reporting'] });
	expect(db.count).toHaveBeenCalledWith({ where });
	expect(db.findMany).toHaveBeenCalledWith(
		expect.objectContaining({ where, skip: 10, take: 10 }),
	);
	expect(await (await list(filters)).json()).toEqual({ data: [], total: 12 });
	const exported = db.findMany.mock.lastCall?.[0];
	expect(exported.where).toEqual(where);
	expect(exported).not.toHaveProperty('take');
	expect(db.groupBy).toHaveBeenCalledTimes(1);
});

it('defaults to the last 30 days only when both bounds are missing', async () => {
	const before = '2024-01-03T00:00:00Z';
	await list({ before });
	expect(db.count.mock.lastCall?.[0].where.question_timestamp).toEqual({ lt: new Date(before) });
	await list({ from: before });
	expect(db.count.mock.lastCall?.[0].where.question_timestamp).toEqual({ gte: new Date(before) });
	const start = Date.now() - 30 * 86400000;
	await list({ source: 'api' });
	expect(
		db.count.mock.lastCall?.[0].where.question_timestamp.gte.getTime(),
	).toBeGreaterThanOrEqual(start);
	expect(db.count.mock.lastCall?.[0].where.question_timestamp.gte.getTime()).toBeLessThanOrEqual(
		Date.now() - 30 * 86400000,
	);
});

const invalidBounds: Record<string, string>[] = [
	{ from: 'invalid' },
	{ before: '2024-02-31T00:00:00Z' },
	{ from: '2024-01-03T00:00:00Z', before: '2024-01-02T00:00:00Z' },
];
it.each(invalidBounds)('rejects invalid bounds %o', async (filters) => {
	expect((await list(filters)).status).toBe(400);
	expect(db.findMany).not.toHaveBeenCalled();
});
