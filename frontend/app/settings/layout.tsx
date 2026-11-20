// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from 'next';
import { SettingsPanelLayout } from '@/components/settings/SettingsPanelLayout';
import { requireUser } from '@/auth/auth-guards';
import { Role } from '@/enums/auth';

export const metadata: Metadata = {
	title: 'Settings',
};

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
	const session = await requireUser();
	const isAdmin = session.user.role === Role.Admin;

	return <SettingsPanelLayout isAdmin={isAdmin}>{children}</SettingsPanelLayout>;
}
