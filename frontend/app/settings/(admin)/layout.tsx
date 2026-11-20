// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0

import { requireAdmin } from '@/auth/auth-guards';

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
	await requireAdmin();
	return children;
}
