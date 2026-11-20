// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSession = vi.hoisted(() => ({ role: 'viewer', signedIn: true }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
	redirect: (path: string) => {
		throw new Error(`redirect:${path}`);
	},
}));
vi.mock('@/auth/auth', () => ({
	auth: {
		api: {
			getSession: async () =>
				mockSession.signedIn ? { user: { role: mockSession.role } } : null,
		},
	},
}));

import { requireAdmin, requireUser } from '../auth/auth-guards';

describe('settings authorization guards', () => {
	beforeEach(() => {
		mockSession.role = 'viewer';
		mockSession.signedIn = true;
	});

	it('allows a viewer to reach personal settings but rejects administrative pages', async () => {
		await expect(requireUser()).resolves.toMatchObject({ user: { role: 'viewer' } });
		await expect(requireAdmin()).rejects.toThrow('redirect:/chat');
	});

	it('allows an administrator to reach administrative pages', async () => {
		mockSession.role = 'admin';
		await expect(requireAdmin()).resolves.toMatchObject({ user: { role: 'admin' } });
	});

	it('requires a session for either type of setting', async () => {
		mockSession.signedIn = false;
		await expect(requireUser()).rejects.toThrow('redirect:/login');
		await expect(requireAdmin()).rejects.toThrow('redirect:/login');
	});
});
