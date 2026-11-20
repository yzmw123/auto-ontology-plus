// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { translateText } from './LanguageProvider';

describe('interface translations', () => {
	it.each([
		['zh', '语言'],
		['ko', '언어'],
		['ja', '言語'],
		['es', 'Idioma'],
	] as const)('translates the language setting to %s', (language, expected) => {
		expect(translateText('Language', language)).toBe(expected);
		expect(translateText(' Language ', language)).toBe(` ${expected} `);
	});

	it('preserves untranslated text and the English interface', () => {
		expect(translateText('An unknown label', 'ja')).toBe('An unknown label');
		expect(translateText('Language', 'en')).toBe('Language');
		expect(translateText('Couldn&apos;t load terms', 'en')).toBe("Couldn't load terms");
		expect(translateText('User text &amp; value', 'en')).toBe('User text &amp; value');
	});

	it.each([
		['zh', '连接测试失败： timeout'],
		['ko', '연결 테스트 실패: timeout'],
		['ja', '接続テストに失敗しました： timeout'],
		['es', 'Falló la prueba de conexión: timeout'],
	] as const)(
		'translates a connection error in %s while preserving its detail',
		(language, expected) => {
			expect(translateText('Connection test failed: timeout', language)).toBe(expected);
		},
	);
	it.each([
		['zh', '密码至少需要 8 个字符。'],
		['ko', '비밀번호는 8자 이상이어야 합니다.'],
		['ja', 'パスワードは 8 文字以上で入力してください。'],
		['es', 'La contraseña debe tener al menos 8 caracteres.'],
	] as const)('translates password length errors in %s', (language, expected) => {
		expect(translateText('Password must be at least 8 characters.', language)).toBe(expected);
	});
});
