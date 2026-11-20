// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState } from 'react';
import { Button } from '@/common/Button';
import { ButtonTheme } from '@/enums/button';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { AnalyticsFilters } from '@/types/analytics';

const fieldClass = 'flex min-w-0 flex-col gap-1 text-xs font-medium text-secondary';
const inputClass =
	'h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-normal text-body focus:border-[#76b900] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

// Treat both selected dates as whole local days, even when the UTC offset changes overnight.
const dateBoundary = (day: string, nextDay = false) => {
	if (!day) return undefined;
	const date = new Date(day + 'T00:00:00');
	if (nextDay) date.setDate(date.getDate() + 1);
	return date.toISOString();
};

export const AnalyticsFilterBar = ({
	onApply,
	sources,
}: {
	onApply: (filters: AnalyticsFilters) => void;
	sources: { value: string; label: string }[];
}) => {
	const { t } = useLanguage();
	const [start, setStart] = useState('');
	const [end, setEnd] = useState('');

	return (
		<form
			aria-label={t('Filters')}
			className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
			onSubmit={(event) => {
				event.preventDefault();
				const form = new FormData(event.currentTarget);
				onApply({
					from: dateBoundary(start),
					before: dateBoundary(end, true),
					username: String(form.get('username') ?? '').trim() || undefined,
					source: String(form.get('source') ?? '') || undefined,
				});
			}}
			onReset={() => {
				setStart('');
				setEnd('');
				onApply({});
			}}
		>
			<div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h2 className="text-sm font-semibold text-heading dark:text-zinc-100">
					{t('Filters')}
				</h2>
				<span className="text-xs text-secondary">
					{t('Default date range: last 30 days')}
				</span>
			</div>
			<div className="flex flex-wrap items-end gap-x-4 gap-y-3">
				<label className={fieldClass}>
					{t('Start date')}
					<input
						className={inputClass}
						name="start"
						type="date"
						value={start}
						max={end || undefined}
						onChange={(event) => setStart(event.target.value)}
					/>
				</label>
				<label className={fieldClass}>
					{t('End date')}
					<input
						className={inputClass}
						name="end"
						type="date"
						value={end}
						min={start || undefined}
						onChange={(event) => setEnd(event.target.value)}
					/>
				</label>
				<label className={fieldClass}>
					{t('User')}
					<input
						className={inputClass}
						type="search"
						name="username"
						placeholder={t('Search by name or email')}
					/>
				</label>
				<label className={fieldClass}>
					{t('Source')}
					<select className={inputClass} name="source">
						<option value="">{t('All')}</option>
						{sources.map(({ value, label }) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</label>
				<div className="flex items-center gap-2">
					<Button type="submit" theme={ButtonTheme.Primary}>
						{t('Apply filters')}
					</Button>
					<Button type="reset" theme={ButtonTheme.Secondary}>
						{t('Reset')}
					</Button>
				</div>
			</div>
		</form>
	);
};
