// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
'use client';

import { type Language, useLanguage } from '../../../i18n/LanguageProvider';

const options: { value: Language; label: string }[] = [
	{ value: 'en', label: 'English' },
	{ value: 'zh', label: '简体中文' },
	{ value: 'ko', label: '한국어' },
	{ value: 'ja', label: '日本語' },
	{ value: 'es', label: 'Español' },
];

export default function LanguageSettingsPage() {
	const { language, setLanguage, t } = useLanguage();
	return (
		<section className="mx-auto w-full max-w-3xl p-6">
			<h1 className="text-2xl font-semibold text-heading">{t('Language')}</h1>
			<p className="mt-2 text-sm text-body">
				{t('Choose the language used for the interface on this browser.')}
			</p>
			<label htmlFor="language" className="mt-6 block text-sm font-medium text-heading">
				{t('Display language')}
			</label>
			<select
				id="language"
				value={language}
				onChange={(event) => setLanguage(event.target.value as Language)}
				className="mt-2 w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-heading dark:border-zinc-700 dark:bg-zinc-900"
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</section>
	);
}
