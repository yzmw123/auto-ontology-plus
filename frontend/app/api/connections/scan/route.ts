// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { withPermission } from '@/auth/with-auth';
import { proxyToBackend } from '@/auth/proxy-backend';

export const GET = withPermission({ connection: ['manage'] })((req) => proxyToBackend(req));
export const POST = withPermission({ connection: ['manage'] })((req) => proxyToBackend(req));
