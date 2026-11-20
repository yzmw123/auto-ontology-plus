// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { withPermission } from '@/auth/with-auth';
import { Role } from '@/enums/auth';
import { analyticsSelect } from '@/lib/apiSelects';
import type { Prisma } from '@/generated/prisma/client';
import { analyticsFilters } from './openapi';

const ANALYTICS_DAYS = 30;

const parseIntParam = (value: string | null, fallback: number): number => {
	if (value == null) return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
};

// Viewing the analytics report requires the analytics:read permission (admin).
export const GET = withPermission({ analytics: ['read'] })(async (request) => {
	const prisma = getPrisma();
	const { searchParams } = new URL(request.url);

	const skip = parseIntParam(searchParams.get('skip'), 0);
	const limitParam = searchParams.get('limit');
	const limit = limitParam != null ? parseIntParam(limitParam, 0) : null;

	const parsed = analyticsFilters.safeParse(Object.fromEntries(searchParams));
	if (!parsed.success) {
		return NextResponse.json({ error: 'Invalid analytics filters' }, { status: 400 });
	}
	const { from, before, username, source } = parsed.data;
	const start = from ? new Date(from) : undefined;
	const end = before ? new Date(before) : undefined;
	if (start && end && start >= end) {
		return NextResponse.json({ error: 'Invalid analytics date range' }, { status: 400 });
	}
	const where: Prisma.ConversationAnalyticsWhereInput = {
		question_timestamp:
			start || end
				? { gte: start, lt: end }
				: { gte: new Date(Date.now() - ANALYTICS_DAYS * 24 * 60 * 60 * 1000) },
	};
	if (source) where.source = source;
	if (username) {
		// PostgreSQL implements contains with ILIKE. Treat typed wildcards as literal characters.
		const pattern = {
			contains: username.replace(/[\\%_]/g, '\\$&'),
			mode: 'insensitive' as const,
		};
		where.user = { OR: [{ name: pattern }, { email: pattern }] };
	}

	const total = await prisma.conversationAnalytics.count({ where });
	// The row stores only `userId`; join the User to resolve the display name.
	const rows = await prisma.conversationAnalytics.findMany({
		where,
		orderBy: [{ question_timestamp: 'desc' }, { id: 'desc' }],
		skip,
		...(limit != null ? { take: limit } : {}),
		select: analyticsSelect,
	});

	const data = rows.map((row) => ({
		...row,
		user: { ...row.user, role: (row.user.role as Role) ?? Role.Viewer },
	}));

	const channels =
		searchParams.get('includeSources') === 'true'
			? await prisma.conversationAnalytics.groupBy({
					by: ['source'],
					orderBy: { source: 'asc' },
				})
			: undefined;
	return NextResponse.json({ data, total, sources: channels?.map(({ source }) => source) });
});
