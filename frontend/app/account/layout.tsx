// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from 'next';
import { requireUser } from '@/auth/auth-guards';

export const metadata: Metadata = {
	title: 'Account',
};

// Account settings are available to any authenticated user.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
	await requireUser();
	return children;
}
