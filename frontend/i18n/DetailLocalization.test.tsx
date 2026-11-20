// @vitest-environment jsdom
// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Breadcrumbs } from '@/common/Breadcrumbs';
import { ActiveExpansionCard } from '@/components/explorationPage/ActiveExpansionCard';
import { SinglePageComposer } from '@/common/SinglePageComposer';
import {
	BreadcrumbProvider,
	useBreadcrumbs,
	useBreadcrumbTrail,
} from '@/contexts/BreadcrumbContext';
import { ComposerSectionKind } from '@/enums/datasources';
import { LanguageProvider, useLanguage } from './LanguageProvider';

vi.mock('next/navigation', () => ({ usePathname: () => '/terms', useRouter: () => ({}) }));

vi.mock('@/common/icons', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/common/icons')>()),
	Icon: () => null,
}));

function Detail() {
	const { items } = useBreadcrumbs();
	const { setLanguage } = useLanguage();
	useBreadcrumbTrail([{ label: 'Description' }]);
	return (
		<>
			<Breadcrumbs items={items} />
			<button onClick={() => setLanguage('en')}>English</button>
			<SinglePageComposer
				header={{ header: { title: 'Description' } }}
				leftPanel={{
					width: '280px',
					bulks: [
						{
							kind: 'activity',
							title: 'Last Modified',
							author: null,
							date: '2026-11-18',
						},
					],
				}}
				sections={[
					{
						type: ComposerSectionKind.TEXT_CARD,
						id: 'description',
						title: 'Description',
						body: 'Synonyms',
					},
					{
						type: ComposerSectionKind.ENTITY_CHIPS,
						id: 'entities',
						title: 'Entities',
						entities: [],
					},
					{
						type: ComposerSectionKind.DATA_TABLE,
						id: 'attributes',
						title: 'Column Attributes',
						columns: [{ key: 'name', label: 'Attribute Name' }],
						rows: [{ name: 'Certification' }],
					},
				]}
			/>
		</>
	);
}

it('switches route, sidebar, section and table labels while preserving catalog text', async () => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	window.localStorage.setItem('auto-ontology-language', 'zh');
	const container = document.createElement('div');
	const root = createRoot(container);
	try {
		await act(async () =>
			root.render(
				<LanguageProvider>
					<BreadcrumbProvider>
						<Detail />
					</BreadcrumbProvider>
				</LanguageProvider>,
			),
		);
		expect(container.querySelector('nav')?.textContent).toBe('术语Description');
		expect(container.querySelector('h1')?.textContent).toBe('Description');
		const headings = () => Array.from(container.querySelectorAll('h2'), (h) => h.textContent);
		expect(headings()).toEqual(
			expect.arrayContaining(['最后修改时间', '描述', '实体 (0)', '列属性']),
		);
		expect(container.querySelector('th')?.textContent).toBe('属性名称');
		expect(container.querySelector('td')?.textContent).toBe('Certification');
		expect(container.querySelector('#description-section p')?.textContent).toBe('Synonyms');
		expect(container.textContent).toContain('2026年11月18日');
		await act(async () => container.querySelector('button')!.click());
		expect(container.querySelector('nav')?.textContent).toBe('TermsDescription');
		expect(headings()).toEqual(
			expect.arrayContaining([
				'Last Modified',
				'Description',
				'Entities (0)',
				'Column Attributes',
			]),
		);
		expect(container.querySelector('th')?.textContent).toBe('Attribute Name');
		expect(container.textContent).toContain('Nov 18, 2026');
	} finally {
		await act(async () => root.unmount());
		window.localStorage.clear();
		vi.unstubAllGlobals();
	}
});

it('localizes graph connection types and hops while preserving endpoint and column names', async () => {
	vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
	window.localStorage.setItem('auto-ontology-language', 'zh');
	const container = document.createElement('div');
	const root = createRoot(container);
	const nodes = [
		{ id: 'start', name: 'Connection', type: 'term' },
		{ id: 'table', name: 'TF_DM_LD_20200727', type: 'table' },
		{ id: 'column', name: 'REPEAT_ROADPART_ID', type: 'column' },
		{ id: 'attribute', name: '道路部分标识符', type: 'columnAttribute' },
		{ id: 'end', name: '道路部分', type: 'term' },
	];
	const codes = ['REPRESENTS', 'CONTAINS', 'SEMANTIC_FK', 'PROPERTY_OF'];
	try {
		await act(async () =>
			root.render(
				<LanguageProvider>
					<ActiveExpansionCard
						node={{
							id: 'start:end',
							kind: 'connection',
							name: 'Connection ↔ 道路部分',
							description: null,
							viewHref: '',
							connectionSource: nodes[0],
							connectionTarget: nodes[4],
							connectionHops: codes.map((relationship, i) => ({
								relationship,
								source: nodes[i],
								target: nodes[i + 1],
							})),
						}}
						onClose={() => {}}
						onView={() => {}}
					/>
				</LanguageProvider>,
			),
		);
		expect(container.querySelector('header p')?.textContent).toBe('关联关系详情');
		expect(container.querySelector('h2 + p')?.textContent).toBe('关联关系');
		for (const label of ['表示', '包含', '语义外键', '属性归属', 'REPEAT_ROADPART_ID'])
			expect(container.textContent).toContain(label);
		for (const code of codes) expect(container.textContent).not.toContain(code);
		expect(container.querySelector('h2')?.textContent).toBe('Connection ↔ 道路部分');
		await act(async () => {
			window.localStorage.setItem('auto-ontology-language', 'en');
			window.dispatchEvent(new Event('auto-ontology-language-change'));
		});
		expect(container.querySelector('header p')?.textContent).toBe(
			'Showing info on this Connection',
		);
		for (const code of codes) expect(container.textContent).toContain(code);
	} finally {
		await act(async () => root.unmount());
		window.localStorage.clear();
		vi.unstubAllGlobals();
	}
});
