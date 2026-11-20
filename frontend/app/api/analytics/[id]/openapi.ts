// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';
import type { OpenApiRoute } from '@/types/openapi';

export const openapi: OpenApiRoute = {
	delete: {
		path: z.object({ id: z.uuid() }),
		responses: {
			200: {
				description: 'The analytics record is absent, including after a repeated deletion.',
				schema: z.object({ id: z.uuid() }),
			},
			400: {
				description: 'Invalid analytics record ID.',
				schema: z.object({ error: z.string() }),
			},
		},
	},
};
