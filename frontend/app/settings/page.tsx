// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { redirect } from 'next/navigation';
import { requireUser } from '@/auth/auth-guards';
import { Role } from '@/enums/auth';

export default async function SettingsPage() {
	const session = await requireUser();
	if (session.user.role !== Role.Admin) redirect('/settings/language');
	redirect('/settings/connections');
}
