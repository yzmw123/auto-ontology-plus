// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: { '@': fileURLToPath(new URL('..', import.meta.url)) },
	},
});
