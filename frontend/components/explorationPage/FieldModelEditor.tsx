// SPDX-License-Identifier: Apache-2.0
'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { requests } from '@/api/requests';
import { Button } from '@/common/Button';
import { Icon, IconName } from '@/common/icons';
import { Modal } from '@/common/modal/Modal';
import { ButtonTheme, Size } from '@/enums/button';
import { useLanguage } from '@/i18n/LanguageProvider';
import type {
	ModelColumn,
	ModelSelection,
	ModelTable,
	FieldWorkspace,
	FieldReference,
	FieldCondition,
} from '@/types/fieldModel';

const base = 'exploration/model';
const field =
	'w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900';
const label = 'flex min-w-0 flex-col gap-1 text-xs font-medium';
const fullName = (table: ModelTable) => [table.database, table.schema, table.name].join('.');
const originLabels = {
	manual: 'Administrator mapping',
	physical: 'Database constraint',
	semantic: 'Inferred reference',
};
type Save = (fn: () => Promise<{ error?: boolean; message?: string }>) => Promise<void>;

function useColumns(table: string) {
	const [result, set] = useState<{ table: string; rows: ModelColumn[]; error?: string }>({
		table: '',
		rows: [],
	});
	useEffect(() => {
		let active = true;
		if (table)
			void requests
				.get<{
					data: ModelColumn[];
				}>(base + '/tables/' + encodeURIComponent(table) + '/columns')
				.then((r) => {
					if (active) set({ table, rows: r.data ?? [], error: r.message });
				});
		return () => {
			active = false;
		};
	}, [table]);
	return result.table === table ? result : { table, rows: [] };
}

const TablePicker = ({
	caption,
	tables,
	termNames,
	selected,
	onSelect,
}: {
	caption: string;
	tables: ModelTable[];
	termNames: Map<string, string>;
	selected?: ModelTable;
	onSelect: (table: ModelTable) => void;
}) => {
	const { t } = useLanguage();
	const id = useId();
	const [query, setQuery] = useState<string | null>(null);
	const [highlight, setHighlight] = useState(0);
	const listRef = useRef<HTMLUListElement>(null);
	const open = query !== null;
	const match = (query ?? '').trim().toLowerCase();
	const options = tables.filter(
		(table) =>
			fullName(table).toLowerCase().includes(match) ||
			table.terms.some((term) => termNames.get(term)?.toLowerCase().includes(match)),
	);
	const choose = (table: ModelTable) => {
		onSelect(table);
		setQuery(null);
	};
	const search = (text: string) => {
		setQuery(text);
		setHighlight(0);
	};
	useEffect(() => {
		if (open) listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' });
	}, [highlight, open]);
	return (
		<div className="relative min-w-0">
			<label htmlFor={id} className={label}>
				{caption}
			</label>
			<div className="relative mt-1">
				<input
					id={id}
					type="text"
					role="combobox"
					autoComplete="off"
					aria-autocomplete="list"
					aria-expanded={open}
					aria-controls={id + '-tables'}
					aria-activedescendant={
						open && options[highlight] ? id + '-' + options[highlight].id : undefined
					}
					className={field + ' truncate pr-7'}
					placeholder={t('Search by table or term name')}
					value={query ?? (selected ? fullName(selected) : '')}
					title={selected ? fullName(selected) : undefined}
					onFocus={() => search('')}
					onClick={() => {
						if (!open) search('');
					}}
					onBlur={() => setQuery(null)}
					onChange={(event) => search(event.target.value)}
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
							return;
						if (event.key === 'Escape' && open) {
							event.preventDefault();
							event.stopPropagation();
							setQuery(null);
						} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
							event.preventDefault();
							if (!open) search('');
							else
								setHighlight(
									Math.max(
										0,
										Math.min(
											options.length - 1,
											highlight + (event.key === 'ArrowDown' ? 1 : -1),
										),
									),
								);
						} else if (event.key === 'Enter' && open) {
							event.preventDefault();
							if (options[highlight]) choose(options[highlight]);
						}
					}}
				/>
				<Icon
					name={IconName.ChevronRight}
					className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 rotate-90 text-secondary"
				/>
			</div>
			{open && (
				<div className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-600 dark:bg-zinc-800">
					<ul
						id={id + '-tables'}
						role="listbox"
						aria-label={caption}
						ref={listRef}
						className="max-h-48 overflow-y-auto overscroll-contain p-1"
					>
						{options.map((table, i) => (
							<li
								key={table.id}
								id={id + '-' + table.id}
								role="option"
								aria-selected={table.id === selected?.id}
								className={
									'cursor-pointer rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 ' +
									(highlight === i ? 'bg-zinc-100 dark:bg-zinc-700' : '')
								}
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => choose(table)}
							>
								<span className="block break-all text-sm">{table.name}</span>
								<span className="block break-all text-xs text-secondary">
									{[table.database, table.schema].join('.')}
								</span>
							</li>
						))}
					</ul>
					{!options.length && (
						<p role="status" className="px-3 pb-2 text-xs text-secondary">
							{t('No matching tables')}
						</p>
					)}
				</div>
			)}
		</div>
	);
};

const ReferenceForm = ({
	model,
	selection,
	record,
	save,
}: {
	model: FieldWorkspace;
	selection: ModelSelection;
	record?: FieldReference;
	save: Save;
}) => {
	const { t } = useLanguage();
	const sourceTerm = record
		? record.source_term
		: selection.kind === 'term'
			? selection.id
			: null;
	const sourceTables = model.tables.filter((table) =>
		sourceTerm
			? table.terms.includes(sourceTerm)
			: table.id === (record?.source_table ?? selection.id),
	);
	const [left, setLeft] = useState(record?.source_table ?? sourceTables[0]?.id ?? '');
	const [right, setRight] = useState(record?.target_table ?? '');
	const [targetTerm, setTargetTerm] = useState(record?.target_term ?? '');
	const [pairs, setPairs] = useState<[string, string][]>(record?.pairs ?? [['', '']]);
	const [name, setName] = useState(record?.name ?? '');
	const [enabled, setEnabled] = useState(record?.enabled ?? true);
	const source = sourceTables.find((table) => table.id === left);
	const relatedTables = model.tables.filter((table) => table.database_id === source?.database_id);
	const target = relatedTables.find((table) => table.id === right);
	const termNames = new Map(model.terms.map((term) => [term.id, term.name]));
	const leftColumns = useColumns(left),
		rightColumns = useColumns(right);
	const changeSource = (table: ModelTable) => {
		if (table.id === left) return;
		const keepTarget = target?.database_id === table.database_id;
		setLeft(table.id);
		if (!keepTarget) {
			setRight('');
			setTargetTerm('');
		}
		setPairs(pairs.map(([, b]) => ['', keepTarget ? b : '']));
	};
	const changeTarget = (table: ModelTable) => {
		if (table.id === right) return;
		setRight(table.id);
		setTargetTerm('');
		setPairs(pairs.map(([a]) => [a, '']));
	};
	const submit = (event: FormEvent) => {
		event.preventDefault();
		const body = {
			name,
			source_term: sourceTerm,
			target_term: targetTerm || null,
			source_table: left,
			target_table: right,
			pairs,
			enabled,
			version: record?.version ?? 0,
		};
		void save(() =>
			record
				? requests.put(base + '/references/' + encodeURIComponent(record.id), body)
				: requests.post(base + '/references', body),
		);
	};
	const grid =
		'grid items-end gap-x-1.5 sm:gap-x-2 ' +
		(pairs.length > 1
			? 'grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)_1.6rem]'
			: 'grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)]');
	const preview = pairs.flatMap(([a, b]) => {
		const x = leftColumns.rows.find((column) => column.id === a);
		const y = rightColumns.rows.find((column) => column.id === b);
		return source && target && x && y
			? [source.name + '.' + x.name + ' = ' + target.name + '.' + y.name]
			: [];
	});
	return (
		<form onSubmit={submit} className="space-y-4">
			<div className={grid}>
				{sourceTables.length === 1 && source ? (
					<label className={label}>
						{t('Starting table')}
						<input
							className={field + ' truncate bg-zinc-50 dark:bg-zinc-800'}
							readOnly
							value={fullName(source)}
							title={fullName(source)}
						/>
					</label>
				) : (
					<TablePicker
						caption={t('Starting table')}
						tables={sourceTables}
						termNames={termNames}
						selected={source}
						onSelect={changeSource}
					/>
				)}
				<span aria-hidden className="pb-2 text-center text-secondary">
					→
				</span>
				<TablePicker
					caption={t('Linked table')}
					tables={relatedTables}
					termNames={termNames}
					selected={target}
					onSelect={changeTarget}
				/>
			</div>
			<div className="space-y-2">
				{pairs.map((pair, index) => (
					<div className={grid} key={index}>
						{([0, 1] as const).map((side) => (
							<label
								key={side}
								className={
									label +
									(side === 1
										? ' col-start-3 row-start-1'
										: ' col-start-1 row-start-1')
								}
							>
								{side === 0 ? t('Starting table field') : t('Linked table field')}
								<select
									required
									className={field}
									disabled={side === 0 ? !source : !target}
									value={pair[side]}
									onChange={(event) => {
										const next: [string, string] = [...pair];
										next[side] = event.target.value;
										setPairs(pairs.map((p, i) => (i === index ? next : p)));
									}}
								>
									<option value="">{t('Select a column')}</option>
									{(side === 0 ? leftColumns : rightColumns).rows.map((col) => (
										<option key={col.id} value={col.id}>
											{col.name}
											{col.data_type && ' · ' + col.data_type}
										</option>
									))}
								</select>
							</label>
						))}
						<span
							aria-hidden
							className="col-start-2 row-start-1 pb-2 text-center text-secondary"
						>
							=
						</span>
						{pairs.length > 1 && (
							<Button
								theme={ButtonTheme.IconDanger}
								iconOnly
								size={Size.SMALL}
								aria-label={t('Remove field pair {number}', { number: index + 1 })}
								onClick={() => setPairs(pairs.filter((_, i) => i !== index))}
							>
								<Icon name={IconName.Trash} className="h-4 w-4" />
							</Button>
						)}
					</div>
				))}
				{(leftColumns.error || rightColumns.error) && (
					<p role="alert">{t(leftColumns.error ?? rightColumns.error ?? '')}</p>
				)}
				<Button
					theme={ButtonTheme.Secondary}
					size={Size.SMALL}
					disabled={!target}
					onClick={() => setPairs([...pairs, ['', '']])}
				>
					{t('Add key pair')}
				</Button>
				{preview.length === pairs.length && (
					<pre className="whitespace-pre-wrap break-all rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">
						{preview.join(' AND ')}
					</pre>
				)}
			</div>
			<label className={label}>
				{t('Link name')}
				<input
					className={field}
					required
					maxLength={255}
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder={t('e.g. Log level or Exit station')}
				/>
			</label>
			{target && target.terms.length > 0 && (
				<details
					key={target.id}
					open={
						record?.target_term && record.target_table === target.id ? true : undefined
					}
					className="text-xs"
				>
					<summary className="w-fit cursor-pointer text-secondary">
						{t('Limit to a term (optional)')}
						{targetTerm && ' · ' + termNames.get(targetTerm)}
					</summary>
					<label className={label + ' mt-2'}>
						{t('Term in the linked table')}
						<select
							className={field}
							value={targetTerm}
							onChange={(event) => setTargetTerm(event.target.value)}
						>
							<option value="">{t('Entire table')}</option>
							{target.terms.map((id) => (
								<option key={id} value={id}>
									{termNames.get(id)}
								</option>
							))}
						</select>
					</label>
				</details>
			)}
			<div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={enabled}
						onChange={(e) => setEnabled(e.target.checked)}
					/>
					{t('Use for questions')}
				</label>
				<Button
					type="submit"
					disabled={!name.trim() || !target || preview.length !== pairs.length}
				>
					{t('Save')}
				</Button>
			</div>
		</form>
	);
};

function ClassForm({ model, id, save }: { model: FieldWorkspace; id: string; save: Save }) {
	const { t } = useLanguage();
	const [create, setCreate] = useState(true);
	const current = model.classifications.find((c) => c.term_id === id);
	const tables = model.tables.filter((x) => x.terms.includes(id));
	const [table, setTable] = useState(tables[0]?.id ?? '');
	const [parent, setParent] = useState('');
	const [name, setName] = useState('');
	const [conditions, setConditions] = useState<FieldCondition[]>([{ column: '', values: [''] }]);
	const [display, setDisplay] = useState<string[]>([]);
	const cols = useColumns(table);
	const load = (isNew: boolean) => {
		setCreate(isNew);
		setName(isNew ? '' : (model.terms.find((x) => x.id === id)?.name ?? ''));
		setParent(isNew ? '' : (current?.parent_id ?? ''));
		setTable(isNew ? (tables[0]?.id ?? '') : (current?.table_id ?? tables[0]?.id ?? ''));
		setConditions(!isNew && current ? current.conditions : [{ column: '', values: [''] }]);
		setDisplay(isNew ? [] : (current?.display_columns ?? []));
	};
	return (
		<form
			className="space-y-3"
			onSubmit={(e) => {
				e.preventDefault();
				void save(() =>
					requests.post(base + '/classifications', {
						term_id: create ? null : id,
						parent_id: create ? id : parent || null,
						name,
						table_id: table,
						conditions,
						display_columns: display,
					}),
				);
			}}
		>
			<label className={label}>
				{t('Classification action')}
				<select
					className={field}
					value={create ? 'new' : 'edit'}
					onChange={(e) => load(e.target.value === 'new')}
				>
					<option value="new">{t('Create child term')}</option>
					<option value="edit">{t('Configure this term')}</option>
				</select>
			</label>
			<label className={label}>
				{t('Term name')}
				<input
					required
					readOnly={!create}
					className={field}
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
			</label>
			<label className={label}>
				{t('Table')}
				<select
					required
					className={field}
					value={table}
					onChange={(e) => {
						setTable(e.target.value);
						setConditions([{ column: '', values: [''] }]);
						setDisplay([]);
						setParent('');
					}}
				>
					{tables.map((x) => (
						<option key={x.id} value={x.id}>
							{fullName(x)}
						</option>
					))}
				</select>
			</label>
			{!create && (
				<label className={label}>
					{t('Parent term')}
					<select
						className={field}
						value={parent}
						onChange={(e) => setParent(e.target.value)}
					>
						<option value="">{t('None')}</option>
						{model.terms
							.filter(
								(x) =>
									x.id !== id &&
									tables.find((v) => v.id === table)?.terms.includes(x.id),
							)
							.map((x) => (
								<option value={x.id} key={x.id}>
									{x.name}
								</option>
							))}
					</select>
				</label>
			)}
			{conditions.map((cond, i) => (
				<div className="flex items-end gap-2" key={i}>
					<label className={label + ' flex-1'}>
						{t('Classification field')}
						<select
							className={field}
							required
							value={cond.column}
							onChange={(e) =>
								setConditions(
									conditions.map((c, j) =>
										j === i ? { ...c, column: e.target.value } : c,
									),
								)
							}
						>
							<option value="">{t('Select a column')}</option>
							{cols.rows.map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))}
						</select>
					</label>
					<label className={label + ' flex-1'}>
						{t('Matching values (one per line)')}
						<textarea
							className={field}
							rows={2}
							required
							value={cond.values.join('\n')}
							onChange={(e) =>
								setConditions(
									conditions.map((c, j) =>
										j === i ? { ...c, values: e.target.value.split('\n') } : c,
									),
								)
							}
						/>
					</label>
					{conditions.length > 1 && (
						<Button
							theme={ButtonTheme.Secondary}
							onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
						>
							{t('Remove')}
						</Button>
					)}
				</div>
			))}
			<Button
				size={Size.SMALL}
				theme={ButtonTheme.Secondary}
				onClick={() => setConditions([...conditions, { column: '', values: [''] }])}
			>
				{t('Add AND condition')}
			</Button>
			<label className={label}>
				{t('Displayed fields (optional)')}
				<select
					multiple
					className={field}
					value={display}
					onChange={(e) => setDisplay([...e.target.selectedOptions].map((o) => o.value))}
				>
					{cols.rows.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</select>
			</label>
			{cols.error && <p role="alert">{t(cols.error)}</p>}
			<Button type="submit">{t('Save')}</Button>
		</form>
	);
}

export function FieldModelEditor({
	selection,
	canEdit,
	onClose,
	onSaved,
}: {
	selection: ModelSelection;
	canEdit: boolean;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { t } = useLanguage();
	const [model, setModel] = useState<FieldWorkspace>();
	const [impact, setImpact] = useState<{
		name: string;
		references: string[];
		children: string[];
		classified: boolean;
	}>();
	const [edit, setEdit] = useState<string | null>(null);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const [confirm, setConfirm] = useState<string | null>(null);
	useEffect(() => {
		let alive = true;
		void requests.get<FieldWorkspace>(base).then((r) => {
			if (alive) {
				if (r.error) setError(r.message ?? 'Error');
				else setModel(r);
			}
		});
		if (selection.action === 'remove')
			void requests
				.get<NonNullable<typeof impact>>(base + '/terms/' + selection.id + '/impact')
				.then((r) => {
					if (alive) {
						if (r.error) setError(r.message ?? 'Error');
						else setImpact(r);
					}
				});
		return () => {
			alive = false;
		};
	}, [selection]);
	const save: Save = async (fn) => {
		if (busy) return;
		setBusy(true);
		setError('');
		try {
			const r = await fn();
			if (r.error) setError(r.message ?? 'Error');
			else onSaved();
		} catch {
			setError('Failed to save changes');
		} finally {
			setBusy(false);
		}
	};
	const selectedTerm = model?.terms.find((x) => x.id === selection.id);
	const belongs = (r: FieldReference, side: 'source' | 'target') =>
		selection.kind === 'table'
			? r[(side + '_table') as 'source_table' | 'target_table'] === selection.id
			: (r[(side + '_term') as 'source_term' | 'target_term'] ?? null)
				? r[(side + '_term') as 'source_term' | 'target_term'] === selection.id
				: model?.tables
						.find(
							(x) => x.id === r[(side + '_table') as 'source_table' | 'target_table'],
						)
						?.terms.includes(selection.id);
	const list =
		model?.references.filter((r) =>
			selection.referenceIds
				? selection.referenceIds.includes(r.id)
				: belongs(r, 'source') || belongs(r, 'target'),
		) ?? [];
	const cls = model?.classifications.find((c) => c.term_id === selection.id);
	const heading =
		selection.action === 'remove'
			? t('Delete term')
			: selection.action === 'class'
				? t('Classification rules')
				: edit === null
					? t('Field references')
					: edit === 'new'
						? t('New link')
						: t('Edit link');
	return (
		<Modal
			open
			onClose={() => {
				if (!busy) onClose();
			}}
			className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden"
		>
			<header className="flex items-center justify-between gap-3 border-b px-5 py-3">
				<div>
					<h2 className="font-semibold">{heading}</h2>
					<p className="text-xs text-secondary">
						{selectedTerm?.name ??
							model?.tables.find((x) => x.id === selection.id)?.name}
					</p>
				</div>
				<Button theme={ButtonTheme.Secondary} disabled={busy} onClick={onClose}>
					{t('Close')}
				</Button>
			</header>
			<fieldset disabled={busy} className="min-h-0 space-y-4 overflow-y-auto p-5">
				{error && (
					<p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">
						{t(error)}
					</p>
				)}
				{!model && !error && <p>{t('Loading…')}</p>}
				{model &&
					selection.action === 'links' &&
					(edit !== null ? (
						<ReferenceForm
							model={model}
							selection={selection}
							record={list.find((r) => r.id === edit)}
							save={save}
						/>
					) : (
						<>
							{cls && (
								<p className="text-sm">
									{t('Classification rules')} ·{' '}
									{cls.predicates
										.map((p) => p.field + ' ∈ ' + p.values.join(' / '))
										.join(' AND ')}
								</p>
							)}
							{canEdit && (
								<Button onClick={() => setEdit('new')}>
									{t('Add field reference')}
								</Button>
							)}
							{!list.length && (
								<p className="text-sm text-secondary">{t('No field references')}</p>
							)}
							{list.map((r) => (
								<article
									key={r.id}
									className="space-y-2 rounded-lg border border-zinc-200 p-3"
								>
									<h3 className="font-semibold">{r.name}</h3>
									<p className="text-xs text-secondary">
										{t(originLabels[r.origin])} ·{' '}
										{r.enabled ? t('Used for questions') : t('Disabled')}
									</p>
									<pre className="whitespace-pre-wrap break-all text-xs">
										{r.fields
											.map(
												([x, y]) =>
													r.source_path.join('.') +
													'.' +
													x +
													' = ' +
													r.target_path.join('.') +
													'.' +
													y,
											)
											.join(' AND ')}
									</pre>
									{canEdit && (
										<div className="flex flex-wrap gap-2">
											<Button
												size={Size.SMALL}
												theme={ButtonTheme.Secondary}
												onClick={() => setEdit(r.id)}
											>
												{t('Edit')}
											</Button>
											<Button
												size={Size.SMALL}
												theme={ButtonTheme.Secondary}
												onClick={() =>
													void save(() =>
														requests.put(
															base +
																'/references/' +
																encodeURIComponent(r.id),
															{ ...r, enabled: !r.enabled },
														),
													)
												}
											>
												{r.enabled ? t('Disable') : t('Enable')}
											</Button>
											{r.origin === 'manual' && !r.origin_key && (
												<Button
													size={Size.SMALL}
													theme={ButtonTheme.DangerSubtle}
													onClick={() =>
														confirm === r.id
															? void save(() =>
																	requests.delete(
																		base +
																			'/references/' +
																			encodeURIComponent(
																				r.id,
																			) +
																			'?version=' +
																			r.version,
																	),
																)
															: setConfirm(r.id)
													}
												>
													{confirm === r.id
														? t('Confirm deletion')
														: t('Delete')}
												</Button>
											)}
										</div>
									)}
								</article>
							))}
						</>
					))}
				{model && canEdit && selection.action === 'class' && (
					<ClassForm model={model} id={selection.id} save={save} />
				)}
				{impact && canEdit && selection.action === 'remove' && (
					<>
						<p>{t('Delete this term from exploration, search and questions?')}</p>
						<p className="text-sm">
							{t('Affected references')}: {impact.references.join('、') || '—'}
						</p>
						{impact.classified && (
							<p>{t('Its classification rules will be removed.')}</p>
						)}
						{impact.children.length > 0 && (
							<p role="alert">
								{t('Move or remove child classifications first')} ·{' '}
								{impact.children.join('、')}
							</p>
						)}
						<Button
							theme={ButtonTheme.Danger}
							disabled={impact.children.length > 0}
							onClick={() =>
								void save(() => requests.delete(base + '/terms/' + selection.id))
							}
						>
							{t('Confirm deletion')}
						</Button>
					</>
				)}
			</fieldset>
		</Modal>
	);
}
