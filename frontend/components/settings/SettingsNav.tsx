// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/i18n/LanguageProvider';

type NavItem = { label: string; href: string };

const CONNECTIONS_NAV_ITEM: NavItem = {
	label: 'Database connections',
	href: '/settings/connections',
};
const ZONES_NAV_ITEM: NavItem = { label: 'Zones', href: '/settings/zones' };
const TAGS_NAV_ITEM: NavItem = { label: 'Tags', href: '/settings/tags' };
const RULES_NAV_ITEM: NavItem = { label: 'Rules', href: '/settings/rules' };
const PII_SETTINGS_NAV_ITEM: NavItem = {
	label: 'PII Settings',
	href: '/settings/pii',
};
const SEMANTIC_INPUT_NAV_ITEM: NavItem = {
	label: 'Semantic Input',
	href: '/settings/semantic-input',
};
const USERS_NAV_ITEM: NavItem = { label: 'Users', href: '/settings/users' };
const SSO_NAV_ITEM: NavItem = { label: 'Single Sign-On', href: '/settings/sso' };
const SEMANTIC_COMPILATION_NAV_ITEM: NavItem = {
	label: 'Semantic Compilation',
	href: '/settings/semantic-compilation',
};
const AGENT_SETTINGS_NAV_ITEM: NavItem = {
	label: 'Agent Settings',
	href: '/settings/agent-settings',
};
const IMPORT_EXPORT_NAV_ITEM: NavItem = {
	label: 'Import / Export',
	href: '/settings/import-export',
};

function rowClassName(selected: boolean) {
	return `flex min-h-9 items-center rounded-lg px-3 text-sm no-underline transition-colors ${
		selected
			? 'bg-[#76b900]/15 font-medium text-heading shadow-sm ring-1 ring-[#76b900]/30 dark:text-zinc-100'
			: 'text-heading hover:bg-zinc-100/90 dark:text-zinc-200 dark:hover:bg-zinc-800/70'
	}`;
}

export type SettingsNavProps = {
	isAdmin: boolean;
};

export const SettingsNav = ({ isAdmin }: SettingsNavProps) => {
	const { t: __uiT } = useLanguage();

	const pathname = usePathname();
	const { t } = useLanguage();

	const items: NavItem[] = [{ label: 'Language', href: '/settings/language' }];
	if (isAdmin) items.push(CONNECTIONS_NAV_ITEM);
	if (isAdmin)
		items.push(
			ZONES_NAV_ITEM,
			TAGS_NAV_ITEM,
			RULES_NAV_ITEM,
			PII_SETTINGS_NAV_ITEM,
			SEMANTIC_INPUT_NAV_ITEM,
			USERS_NAV_ITEM,
			SSO_NAV_ITEM,
			SEMANTIC_COMPILATION_NAV_ITEM,
			AGENT_SETTINGS_NAV_ITEM,
			IMPORT_EXPORT_NAV_ITEM,
		);

	return (
		<nav
			className="flex min-h-0 flex-1 flex-col gap-y-1 overflow-y-auto px-3 py-2 sm:px-4"
			aria-label={__uiT('Settings sections')}
		>
			{items.map((item) => {
				const selected = pathname === item.href || pathname.startsWith(`${item.href}/`);
				return (
					<Link key={item.href} href={item.href} className={rowClassName(selected)}>
						{t(item.label)}
					</Link>
				);
			})}
		</nav>
	);
};
