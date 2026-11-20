// @vitest-environment jsdom
// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsNav } from '../components/settings/SettingsNav';
import AdminSettingsLayout from '../app/settings/(admin)/layout';
import SettingsPage from '../app/settings/page';
import { LanguageProvider } from './LanguageProvider';

const mocks = vi.hoisted(() => ({
	role: 'viewer',
	requireAdmin: vi.fn(),
	readConnections: vi.fn(),
}));
vi.mock('next/navigation', () => ({
	usePathname: () => '/settings/language',
	redirect: (path: string) => {
		throw new Error(`redirect:${path}`);
	},
}));
vi.mock('next/link', () => ({
	default: ({ href, children }: { href: string; children: React.ReactNode }) => (
		<a href={href}>{children}</a>
	),
}));
vi.mock('@/auth/auth-guards', () => ({
	requireUser: async () => ({ user: { role: mocks.role } }),
	requireAdmin: mocks.requireAdmin,
}));
vi.mock('@/lib/server/connections', () => ({
	readConnectionsEnvSource: mocks.readConnections,
}));

describe('settings access', () => {
	beforeEach(() => {
		mocks.role = 'viewer';
		mocks.requireAdmin.mockReset();
		mocks.readConnections.mockReset();
		document.body.innerHTML = '<div id="root"></div>';
	});

	it('shows only language settings to a viewer', async () => {
		const container = document.getElementById('root')!;
		const root = createRoot(container);
		await act(async () =>
			root.render(
				<LanguageProvider>
					<SettingsNav connectionsEnvManaged={false} isAdmin={false} />
				</LanguageProvider>,
			),
		);
		expect(
			Array.from(container.querySelectorAll('a')).map((link) => link.getAttribute('href')),
		).toEqual(['/settings/language']);
		await act(async () => root.unmount());
		await expect(SettingsPage()).rejects.toThrow('redirect:/settings/language');
		expect(mocks.readConnections).not.toHaveBeenCalled();
	});

	it('requires an administrator for administrative settings', async () => {
		mocks.requireAdmin.mockRejectedValue(new Error('redirect:/chat'));
		await expect(AdminSettingsLayout({ children: 'sensitive page' })).rejects.toThrow(
			'redirect:/chat',
		);
		expect(mocks.requireAdmin).toHaveBeenCalledOnce();
	});

	it('keeps the administrative settings visible to an admin', async () => {
		mocks.role = 'admin';
		mocks.readConnections.mockResolvedValue(false);
		await expect(SettingsPage()).rejects.toThrow('redirect:/settings/connections');
		const container = document.getElementById('root')!;
		const root = createRoot(container);
		await act(async () =>
			root.render(
				<LanguageProvider>
					<SettingsNav connectionsEnvManaged={false} isAdmin />
				</LanguageProvider>,
			),
		);
		expect(container.querySelector('a[href="/settings/users"]')).not.toBeNull();
		expect(container.querySelector('a[href="/settings/language"]')).not.toBeNull();
		await act(async () => root.unmount());
	});
});
