// SPDX-License-Identifier: Apache-2.0
export type ModelTable = {
	id: string;
	name: string;
	schema: string;
	database: string;
	database_id: string;
	pk: string[] | null;
	terms: string[];
};
export type ModelColumn = { id: string; name: string; data_type: string | null };
export type FieldReference = {
	id: string;
	name: string;
	origin: 'physical' | 'semantic' | 'manual';
	origin_key: string | null;
	enabled: boolean;
	valid: boolean;
	version: number;
	source_table: string;
	target_table: string;
	source_term: string | null;
	target_term: string | null;
	pairs: [string, string][];
	fields: [string, string][];
	source_path: string[];
	target_path: string[];
};
export type FieldCondition = { column: string; values: string[] };
export type TermClass = {
	term_id: string;
	name: string;
	parent_id: string | null;
	table_id: string;
	conditions: FieldCondition[];
	display_columns: string[];
	predicates: (FieldCondition & { field: string })[];
};
export type FieldWorkspace = {
	tables: ModelTable[];
	terms: { id: string; name: string }[];
	references: FieldReference[];
	classifications: TermClass[];
};
export type ModelSelection = {
	id: string;
	kind: 'term' | 'table';
	action: 'links' | 'class' | 'remove';
	referenceIds?: string[];
};
