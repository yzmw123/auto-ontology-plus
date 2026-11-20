// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { redirect } from 'next/navigation';
import { readConnectionsEnvSource } from '@/lib/server/connections';
import { requireUser } from '@/auth/auth-guards';
import { Role } from '@/enums/auth';

// Viewers land on their language preference. Admins land on the first available
// administrative section, which depends on whether connections are managed by
// the environment.
export default async function SettingsPage() {
	const session = await requireUser();
	if (session.user.role !== Role.Admin) redirect('/settings/language');
	const envManaged = await readConnectionsEnvSource();
	redirect(envManaged === true ? '/settings/zones' : '/settings/connections');
}
