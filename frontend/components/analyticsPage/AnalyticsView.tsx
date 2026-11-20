// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/common/Button';
import { EmptyState } from '@/common/EmptyState';
import { Size, ButtonTheme } from '@/enums/button';
import { ToastVariant } from '@/enums/toast';
import { Icon, IconName } from '@/common/icons';
import { SkeletonTable } from '@/common/Skeleton';
import { Table } from '@/common/Table';
import { AnalyticsFilterBar } from './AnalyticsFilterBar';
import { ConfirmModal } from '@/common/modal/ConfirmModal';
import { AnalyticsDetails } from './AnalyticsDetails';
import { Toast } from '@/common/Toast';
import { analyticsApi } from '@/api/analytics';
import { formatDate } from '@/common/date';
import { usePagination } from '@/hooks/usePagination';
import type { AnalyticsFilters, ConversationAnalytics } from '@/types/analytics';
import type { TableColumn } from '@/types/table';
import { T, useLanguage } from '@/i18n/LanguageProvider';

const CSV_HEADERS = ['Timestamp', 'User', 'Source', 'Question', 'Reasoning', 'SQL'];
const timeLabel = (value: string) => formatDate(value, 'YYYY/MM/DD/HH:mm:ss');
const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const AnalyticsView = () => {
	const { t, language } = useLanguage();

	const [rows, setRows] = useState<ConversationAnalytics[]>([]);
	const [total, setTotal] = useState(0);
	const [filters, setFilters] = useState<AnalyticsFilters>({});
	const [sources, setSources] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [detail, setDetail] = useState<ConversationAnalytics | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<ConversationAnalytics | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [revision, setRevision] = useState(0);
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Kept apart from `error`: the table below only renders while `error` is
	// null, so a failed export must not take the rows already on screen with it.
	const [downloadError, setDownloadError] = useState<string | null>(null);
	const { skip, pageSize, pagination } = usePagination({
		totalItems: total,
		resetKey: JSON.stringify(filters),
	});
	const hasFilters = Object.values(filters).some(Boolean);
	const channelOptions =
		filters.source && !sources.includes(filters.source)
			? [...sources, filters.source]
			: sources;

	useEffect(() => {
		let cancelled = false;

		(async () => {
			setLoading(true);
			const res = await analyticsApi.list({
				...filters,
				skip,
				limit: pageSize,
				includeSources: skip === 0,
			});
			if (cancelled) return;
			if (res.error) {
				// The page already on screen is left alone: dropping the total
				// would collapse the pager to page one and send the request for
				// it, so a single failed request would cost two.
				setError(res.message ?? 'Failed to load analytics');
			} else {
				setError(null);
				setRows(res.data ?? []);
				setTotal(res.total);
				if (res.sources) setSources(res.sources);
			}
			setLoading(false);
		})();

		return () => {
			cancelled = true;
		};
	}, [skip, pageSize, revision, filters]);
	const sourceLabel = (source: string) => {
		switch (source?.toLowerCase()) {
			case 'app':
				return t('Web app');
			case 'api':
				return 'API';
			default:
				return source || '—';
		}
	};

	const columns: TableColumn<ConversationAnalytics>[] = [
		{
			key: 'question_timestamp',
			header: t('Timestamp'),
			width: 'w-48',
			truncate: true,
			cell: (row) => timeLabel(row.question_timestamp),
		},
		{
			key: 'user',
			header: t('User'),
			width: 'w-36',
			truncate: true,
			cell: (row) => row.user.name || row.user.email,
		},
		{
			key: 'source',
			header: t('Source'),
			width: 'w-24',
			truncate: true,
			cell: (row) => sourceLabel(row.source),
		},
		{ key: 'question', header: t('Question'), truncate: true, cell: (row) => row.question },
		{ key: 'response', header: t('Reasoning'), truncate: true, cell: (row) => row.response },
		{ key: 'sql', header: t('SQL statement'), truncate: true, cell: (row) => row.sql },
		{
			key: 'actions',
			header: t('Actions'),
			width: 'w-16',
			cell: (row) => (
				<Button
					theme={ButtonTheme.IconDanger}
					size={Size.SMALL}
					iconOnly
					title={t('Delete analytics record')}
					aria-label={t('Delete analytics record')}
					onClick={(event) => {
						event.stopPropagation();
						setDeleteError(null);
						setDeleteTarget(row);
					}}
				>
					<Icon name={IconName.Trash} className="h-4 w-4" />
				</Button>
			),
		},
	];

	const confirmDelete = async () => {
		if (!deleteTarget || deleting) return;
		setDeleting(true);
		setDeleteError(null);
		try {
			const result = await analyticsApi.remove(deleteTarget.id);
			if (result.error) {
				setDeleteError(result.message ?? 'Failed to delete analytics record');
				return;
			}
			setDeleteTarget(null);
			setRows((current) => current.filter((row) => row.id !== deleteTarget.id));
			setTotal((current) => Math.max(0, current - 1));
			setRevision((current) => current + 1);
		} catch {
			setDeleteError('Failed to delete analytics record');
		} finally {
			setDeleting(false);
		}
	};

	const downloadRows = (analytics: ConversationAnalytics[]) => {
		const lines = [
			(language === 'en'
				? CSV_HEADERS
				: CSV_HEADERS.map((label) => t(label === 'SQL' ? 'SQL statement' : label))
			)
				.map(escapeCsv)
				.join(','),
			...analytics.map((row) =>
				[
					timeLabel(row.question_timestamp),
					row.user.name || row.user.email,
					row.source ?? '',
					row.question ?? '',
					row.response ?? '',
					row.sql ?? '',
				]
					.map(escapeCsv)
					.join(','),
			),
		];
		const csv = lines.join('\r\n');

		const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const filename = `auto-ontology-analytics-${formatDate(Date.now(), 'YYYY-MM')}.csv`;
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
	};

	const handleDownload = async () => {
		setDownloading(true);
		setDownloadError(null);
		const res = await analyticsApi.list(filters);
		setDownloading(false);
		if (res.error) {
			setDownloadError(res.message ?? 'Failed to download analytics');
			return;
		}
		downloadRows(res.data ?? []);
	};

	return (
		<div className="flex h-full w-full flex-col bg-white dark:bg-zinc-950">
			<header className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
				<Icon name={IconName.ChartLine} className="h-5 w-5 text-body dark:text-zinc-300" />
				<h1 className="text-lg font-semibold tracking-tight text-heading dark:text-zinc-100">
					<T value={'Analytics'} />
				</h1>
				<div className="ml-auto">
					<Button
						theme={ButtonTheme.Primary}
						size={Size.REGULAR}
						type="button"
						onClick={handleDownload}
						disabled={loading || total === 0 || downloading}
						shadow
					>
						{downloading ? t('Preparing download…') : t('Download')}
					</Button>
				</div>
			</header>

			<div className="flex-1 overflow-y-auto px-6 py-6">
				<AnalyticsFilterBar
					onApply={setFilters}
					sources={channelOptions
						.filter(Boolean)
						.map((value) => ({ value, label: sourceLabel(value) }))}
				/>
				{loading && (
					<div role="status" aria-label={t('Loading analytics')}>
						<SkeletonTable columns={columns.length} rows={10} />
					</div>
				)}

				{!loading && error == null && total === 0 && (
					<EmptyState
						icon={IconName.ChartLine}
						title={
							hasFilters ? t('No matching records') : t('No Analytics Recorded Yet')
						}
						description={
							hasFilters
								? t('Try changing your filters.')
								: t(
										'Analytics are captured automatically when you send messages in a conversation.',
									)
						}
					/>
				)}

				{!loading && error == null && rows.length > 0 && (
					<Table
						columns={columns}
						onRowClick={(row) => setDetail(row)}
						cellClassName="px-4 py-2"
						minWidthClass="min-w-[60rem]"
						scrollClassName="overflow-x-auto"
						rows={rows}
						rowKey={(row) => row.id}
						pagination={{
							...pagination,
							rangeTextFormatFn: ({ firstItemIndex, lastItemIndex, totalItems }) =>
								t('{first}–{last} of {total}', {
									first: firstItemIndex,
									last: lastItemIndex,
									total: totalItems,
								}),
						}}
					/>
				)}
			</div>

			{detail && (
				<AnalyticsDetails
					record={detail}
					timeLabel={timeLabel}
					source={sourceLabel(detail.source)}
					onClose={() => setDetail(null)}
				/>
			)}
			<ConfirmModal
				open={deleteTarget !== null}
				title={t('Delete analytics record')}
				message={
					<>
						<p>{t('Permanently delete this analytics record?')}</p>
						<p className="mt-3 line-clamp-3 whitespace-pre-wrap wrap-anywhere font-medium">
							{deleteTarget?.question}
						</p>
					</>
				}
				confirming={deleting}
				error={deleteError}
				onConfirm={confirmDelete}
				onCancel={() => {
					if (!deleting) setDeleteTarget(null);
				}}
			/>

			<Toast
				open={error !== null}
				message={error ?? ''}
				title={t("Couldn't load analytics")}
				variant={ToastVariant.Error}
				onClose={() => setError(null)}
			/>

			<Toast
				open={downloadError !== null}
				message={downloadError ?? ''}
				title={t("Couldn't download analytics")}
				variant={ToastVariant.Error}
				onClose={() => setDownloadError(null)}
			/>
		</div>
	);
};
