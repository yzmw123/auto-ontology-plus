// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

'use client';

import { useEffect, useRef } from 'react';
import { Button, CopyButton } from '@/common/Button';
import { Icon, IconName } from '@/common/icons';
import { ButtonTheme, Size } from '@/enums/button';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { ConversationAnalytics } from '@/types/analytics';

type AnalyticsDetailsProps = {
	record: ConversationAnalytics;
	source: string;
	timeLabel: (value: string) => string;
	onClose: () => void;
};

export function AnalyticsDetails({ record, source, timeLabel, onClose }: AnalyticsDetailsProps) {
	const { t } = useLanguage();
	const dialogRef = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		dialog.showModal();
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
			dialog.close();
		};
	}, []);

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="analytics-record-title"
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			className="fixed inset-0 m-auto max-h-[88dvh] w-[min(52rem,calc(100%-2rem))] max-w-none flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 text-body shadow-2xl open:flex backdrop:bg-zinc-950/45 backdrop:backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
		>
			<header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-700 sm:px-7">
				<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#76b900]/15 text-[#568600] dark:text-[#a3d63a]">
					<Icon name={IconName.ChartLine} className="h-5 w-5" />
				</span>
				<h2
					id="analytics-record-title"
					className="min-w-0 flex-1 text-lg font-semibold text-heading dark:text-zinc-100"
				>
					{t('Analytics record details')}
				</h2>
				<Button
					type="button"
					theme={ButtonTheme.IconNeutral}
					size={Size.SMALL}
					iconOnly
					aria-label={t('Close')}
					onClick={onClose}
				>
					<Icon name={IconName.Close} className="h-5 w-5" />
				</Button>
			</header>
			<div
				className="min-h-0 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7"
				tabIndex={0}
			>
				<dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm sm:grid-cols-2 dark:border-zinc-700 dark:bg-zinc-800/50">
					<div>
						<dt className="mb-1 text-xs text-secondary">{t('User')}</dt>
						<dd className="wrap-anywhere">
							{record.user.name || record.user.email}
							{record.user.email &&
								record.user.name &&
								record.user.name !== record.user.email && (
									<span className="block text-xs text-secondary">
										{record.user.email}
									</span>
								)}
						</dd>
					</div>
					<div>
						<dt className="mb-1 text-xs text-secondary">{t('Source')}</dt>
						<dd>{source}</dd>
					</div>
					<div>
						<dt className="mb-1 text-xs text-secondary">{t('Timestamp')}</dt>
						<dd>{timeLabel(record.question_timestamp)}</dd>
					</div>
					<div>
						<dt className="mb-1 text-xs text-secondary">{t('Response time')}</dt>
						<dd>
							{record.response_timestamp ? timeLabel(record.response_timestamp) : '—'}
						</dd>
					</div>
				</dl>
				{[
					[t('Question'), record.question],
					[t('Reasoning'), record.response],
				].map(([label, value]) => (
					<section key={label}>
						<h3 className="mb-2 text-sm font-semibold text-heading dark:text-zinc-100">
							{label}
						</h3>
						<p className="whitespace-pre-wrap wrap-anywhere text-sm leading-6">
							{value || '—'}
						</p>
					</section>
				))}
				<section className="group overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100">
					<header className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
						<h3 className="text-sm font-semibold">{t('SQL statement')}</h3>
						{record.sql && <CopyButton text={record.sql} />}
					</header>
					<pre className="whitespace-pre-wrap wrap-anywhere p-4 font-mono text-xs leading-6">
						<code>{record.sql || '—'}</code>
					</pre>
				</section>
			</div>
		</dialog>
	);
}
