// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Suspense } from 'react';

import { ExplorationView } from '@/components/explorationPage';
import { ExplorationLoader } from '@/components/explorationPage/ExplorationLoader';

import { requireUser } from '@/auth/auth-guards';
import { Role } from '@/enums/auth';

export default async function ExplorationPage() {
	const session = await requireUser();
	return (
		<Suspense fallback={<ExplorationLoader />}>
			<ExplorationView canEdit={session.user.role === Role.Admin} />
		</Suspense>
	);
}
