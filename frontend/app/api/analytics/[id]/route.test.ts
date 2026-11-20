// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, expect, it, vi } from 'vitest';
import { DELETE } from './route';

const auth = vi.hoisted(() => ({ role: 'admin' as string | null }));
const remove = vi.hoisted(() => vi.fn());
vi.mock('@/auth/resolve-user', () => ({
	resolveUser: async () => (auth.role ? { id: 'caller', role: auth.role } : null),
}));
vi.mock('@/lib/prisma', () => ({
	getPrisma: () => ({ conversationAnalytics: { deleteMany: remove } }),
}));

const id = 'cd0c06dd-7589-4818-a6c5-de4e59a135f0';
const requestDelete = (recordId = id) =>
	DELETE(new Request('http://localhost/api/analytics/' + recordId, { method: 'DELETE' }), {
		params: Promise.resolve({ id: recordId }),
	});

beforeEach(() => {
	auth.role = 'admin';
	remove.mockReset();
});

it.each([
	[null, 401],
	['viewer', 403],
] as const)('rejects deletion for %s', async (role, status) => {
	auth.role = role;
	expect((await requestDelete()).status).toBe(status);
	expect(remove).not.toHaveBeenCalled();
});

it('validates the record ID before deleting', async () => {
	expect((await requestDelete('invalid')).status).toBe(400);
	expect(remove).not.toHaveBeenCalled();
});

it('deletes only the requested analytics record and accepts a retry', async () => {
	remove.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
	for (let attempt = 0; attempt < 2; attempt++) {
		const res = await requestDelete();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ id });
		expect(remove).toHaveBeenLastCalledWith({ where: { id } });
	}
});
