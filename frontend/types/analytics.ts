// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { User } from '@/types/auth';

export type AnalyticsFilters = {
	from?: string;
	before?: string;
	username?: string;
	source?: string;
};

export type ConversationAnalytics = {
	id: string;
	user: User;
	source: string;
	question: string;
	question_timestamp: string;
	response: string | null;
	response_timestamp: string | null;
	sql: string | null;
};
