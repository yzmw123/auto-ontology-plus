// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { requests } from './requests';
import type { AnalyticsFilters, ConversationAnalytics } from '@/types/analytics';
import type { ResponseWithError } from './types';

type ListResult = { data: ConversationAnalytics[]; total: number; sources?: string[] };
type ListResponse = ResponseWithError<ListResult>;

export const analyticsApi = {
	list: (
		params: AnalyticsFilters & { skip?: number; limit?: number; includeSources?: boolean } = {},
	): Promise<ListResponse> => requests.get<ListResult>('analytics', params),
	remove: (id: string) => requests.delete<{ id: string }>(`analytics/${encodeURIComponent(id)}`),
};
