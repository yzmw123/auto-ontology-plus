// @vitest-environment jsdom
// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import LanguageSettingsPage from '../app/settings/language/page';
import { LanguageProvider, T } from './LanguageProvider';

describe('language settings', () => {
	beforeEach(() => {
		window.localStorage.clear();
		document.body.innerHTML = '<div id="root"></div>';
	});

	afterEach(() => {
		window.localStorage.clear();
	});

	it('switches the interface and restores the preference after remounting', async () => {
		const container = document.getElementById('root')!;
		let root = createRoot(container);
		await act(async () =>
			root.render(
				<LanguageProvider>
					<LanguageSettingsPage />
				</LanguageProvider>,
			),
		);
		const select = container.querySelector('select')!;
		expect(select.value).toBe('en');
		await act(async () => {
			select.value = 'ja';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(container.querySelector('h1')?.textContent).toBe('言語');
		expect(window.localStorage.getItem('auto-ontology-language')).toBe('ja');
		expect(document.documentElement.lang).toBe('ja');
		await act(async () => root.unmount());
		root = createRoot(container);
		await act(async () =>
			root.render(
				<LanguageProvider>
					<LanguageSettingsPage />
				</LanguageProvider>,
			),
		);
		expect(container.querySelector('select')?.value).toBe('ja');
		await act(async () => root.unmount());
	});

	it.each([
		['zh', '语言', '加载数据库失败。'],
		['ko', '언어', '데이터베이스를 불러오지 못했습니다.'],
		['ja', '言語', 'データベースを読み込めませんでした。'],
		['es', 'Idioma', 'No se pudieron cargar las bases de datos.'],
	])('updates the setting and an existing error in %s', async (language, heading, error) => {
		const container = document.getElementById('root')!;
		const root = createRoot(container);
		await act(async () =>
			root.render(
				<LanguageProvider>
					<LanguageSettingsPage />
					<p>
						<T value="Failed to load databases." />
					</p>
				</LanguageProvider>,
			),
		);
		const select = container.querySelector('select')!;
		await act(async () => {
			select.value = language;
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(container.querySelector('h1')?.textContent).toBe(heading);
		expect(container.querySelector('section + p')?.textContent).toBe(error);
		await act(async () => root.unmount());
	});
});
