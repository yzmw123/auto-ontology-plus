// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import zh from './zh.json';
import ko from './ko.json';
import ja from './ja.json';
import es from './es.json';

const dictionaries: Record<string, Record<string, string>> = { zh, ko, ja, es };

const sourceFiles = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const filename = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			return ['api', 'tests', '__tests__'].includes(entry.name) ? [] : sourceFiles(filename);
		}
		return filename.endsWith('.tsx') ? [filename] : [];
	});

const referencedMessages = (): Set<string> => {
	const messages = new Set<string>();
	for (const directory of ['app', 'common', 'components']) {
		for (const filename of sourceFiles(path.join(process.cwd(), directory))) {
			const source = ts.createSourceFile(
				filename,
				readFileSync(filename, 'utf8'),
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TSX,
			);
			const visit = (node: ts.Node) => {
				if (ts.isJsxOpeningLikeElement(node) && node.tagName.getText(source) === 'T') {
					const attribute = node.attributes.properties.find(
						(item) => ts.isJsxAttribute(item) && item.name.getText(source) === 'value',
					);
					if (attribute && ts.isJsxAttribute(attribute) && attribute.initializer) {
						const value = ts.isJsxExpression(attribute.initializer)
							? attribute.initializer.expression
							: attribute.initializer;
						if (value && ts.isStringLiteral(value)) messages.add(value.text);
					}
				}
				if (
					ts.isCallExpression(node) &&
					ts.isIdentifier(node.expression) &&
					['t', '__uiT'].includes(node.expression.text) &&
					node.arguments.length >= 1 &&
					ts.isStringLiteral(node.arguments[0])
				) {
					messages.add(node.arguments[0].text);
				}
				ts.forEachChild(node, visit);
			};
			visit(source);
		}
	}
	return messages;
};

describe('translation coverage for referenced interface text', () => {
	it.each(Object.entries(dictionaries))(
		'%s contains each referenced translation',
		(_, dictionary) => {
			const missing = [...referencedMessages()].filter(
				(message) => !Object.hasOwn(dictionary, message) || !dictionary[message].trim(),
			);
			expect(missing).toEqual([]);
		},
	);
});
