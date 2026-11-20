// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withPermission } from '@/auth/with-auth';
import { getPrisma } from '@/lib/prisma';

type Context = { params: Promise<{ id: string }> };

export const DELETE = withPermission<Context>({ analytics: ['delete'] })(async (
	_request,
	{ params },
) => {
	const { id } = await params;
	if (!z.uuid().safeParse(id).success) {
		return NextResponse.json({ error: 'Invalid analytics record ID' }, { status: 400 });
	}
	// A retry after deletion already has the desired result.
	await getPrisma().conversationAnalytics.deleteMany({ where: { id } });
	return NextResponse.json({ id });
});
