// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/api/search';
import { Button } from '@/common/Button';
import { EmptyState } from '@/common/EmptyState';
import { GlobalSearchResults, GlobalSearchResultsSkeleton } from '@/common/GlobalSearchResults';
import { GlobalSearchTabs, totalGlobalSearchCount } from '@/common/GlobalSearchTabs';
import { GLOBAL_SEARCH_ALL_TAB } from '@/constants/search';
import { ButtonTheme } from '@/enums/button';
import { useLanguage } from '@/i18n/LanguageProvider';
import type { DiscoveryFilters } from '@/types/discovery';

export const CatalogBrowse = ({
	filters,
	onReset,
}: {
	filters: DiscoveryFilters;
	onReset: () => void;
}) => {
	const { t } = useLanguage();
	const [tab, setTab] = useState(GLOBAL_SEARCH_ALL_TAB as string);
	const [page, setPage] = useState(1);
	const { objects, tags, data } = filters;
	const query = useQuery({
		queryKey: ['discovery-browse', objects, tags, data, tab, page],
		queryFn: async ({ signal }) => {
			const controller = new AbortController();
			const cancel = () => controller.abort();
			signal.addEventListener('abort', cancel, { once: true });
			try {
				const result = await searchApi.browse(
					{
						objects: objects ?? undefined,
						tags: tags ?? undefined,
						data: data ?? undefined,
					},
					tab === GLOBAL_SEARCH_ALL_TAB ? null : tab,
					page,
					controller,
				);
				if (result.error) throw new Error(result.message);
				return result;
			} finally {
				signal.removeEventListener('abort', cancel);
			}
		},
	});
	if (query.isPending) return <GlobalSearchResultsSkeleton />;
	if (query.isError)
		return (
			<EmptyState
				title={t('Catalog unavailable')}
				description={query.error.message}
				action={{ label: t('Try Again'), onClick: () => void query.refetch() }}
			/>
		);
	const { counts, data: items, page: current, page_size: size } = query.data;
	const total = totalGlobalSearchCount(counts);
	const filtered = objects !== null || tags !== null || data !== null;
	if (!total)
		return (
			<EmptyState
				title={t(filtered ? 'No objects match these filters' : 'The catalog is empty')}
				description={t(
					filtered
						? 'Clear the filters to see all catalog objects.'
						: 'Ask an administrator to connect and scan a database.',
				)}
				action={filtered ? { label: t('Clear filters'), onClick: onReset } : undefined}
			/>
		);
	const pages = Math.max(
		1,
		Math.ceil((tab === GLOBAL_SEARCH_ALL_TAB ? total : (counts[tab] ?? 0)) / size),
	);
	return (
		<>
			<section className="shrink-0 border-b border-zinc-200 px-4 pt-3 dark:border-zinc-800">
				<h2 className="mb-2 px-2 font-semibold">{t('Catalog overview')}</h2>
				<GlobalSearchTabs
					counts={counts}
					showEmpty={!filtered}
					selected={tab}
					onSelect={(type) => {
						setPage(1);
						setTab(type);
					}}
				/>
			</section>
			<div className="min-h-0 flex-1 overflow-y-auto px-3" key={current + tab}>
				<GlobalSearchResults
					items={items}
					query=""
					descriptionSearched={false}
					onNavigate={() => {}}
				/>
			</div>
			<nav
				aria-label={t('Catalog pages')}
				className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-200 px-6 py-2 text-sm dark:border-zinc-800"
			>
				<Button
					theme={ButtonTheme.Outline}
					disabled={current <= 1}
					onClick={() => setPage(current - 1)}
				>
					{t('Previous page')}
				</Button>
				<span aria-live="polite">
					{current} / {pages}
				</span>
				<Button
					theme={ButtonTheme.Outline}
					disabled={current >= pages}
					onClick={() => setPage(current + 1)}
				>
					{t('Next page')}
				</Button>
			</nav>
		</>
	);
};
