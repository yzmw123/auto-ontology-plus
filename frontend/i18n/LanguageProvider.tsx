// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0
'use client';

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useSyncExternalStore,
} from 'react';
import zh from './zh.json';
import ko from './ko.json';
import ja from './ja.json';
import es from './es.json';

export type Language = 'en' | 'zh' | 'ko' | 'ja' | 'es';
const dictionaries: Record<Exclude<Language, 'en'>, Record<string, string>> = { zh, ko, ja, es };
const storageKey = 'auto-ontology-language';
const changeEvent = 'auto-ontology-language-change';
const languages: Language[] = ['en', 'zh', 'ko', 'ja', 'es'];
let temporaryLanguage: Language | null = null;

const subscribe = (callback: () => void) => {
	window.addEventListener(changeEvent, callback);
	window.addEventListener('storage', callback);
	return () => {
		window.removeEventListener(changeEvent, callback);
		window.removeEventListener('storage', callback);
	};
};
const getLanguage = (): Language => {
	if (temporaryLanguage) return temporaryLanguage;
	try {
		const saved = window.localStorage.getItem(storageKey);
		return languages.find((language) => language === saved) ?? 'en';
	} catch {
		return 'en';
	}
};
const getServerLanguage = (): Language => 'en';

const entities: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&apos;': "'",
	'&#39;': "'",
	'&nbsp;': '\u00a0',
};
const decodeEntities = (text: string) =>
	text.replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g, (entity) => entities[entity]);

export const translateText = (text: string, language: Language): string => {
	const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
	if (!match) return text;
	const [, leading, content, trailing] = match;
	if (language === 'en') {
		return Object.hasOwn(zh, content) ? leading + decodeEntities(content) + trailing : text;
	}
	const dictionary = dictionaries[language];
	const exact = dictionary[content];
	if (exact) return leading + decodeEntities(exact) + trailing;
	const passwordLength = /^Password must be at (least|most) (\d+) characters\.$/.exec(content);
	if (passwordLength) {
		const key = `Password must be at ${passwordLength[1]} {count} characters.`;
		return leading + dictionary[key].replace('{count}', passwordLength[2]) + trailing;
	}
	const prefix = 'Connection test failed:';
	if (content.startsWith(prefix)) {
		return leading + dictionary[prefix] + content.slice(prefix.length) + trailing;
	}
	return Object.hasOwn(zh, content) ? leading + decodeEntities(content) + trailing : text;
};

type LanguageContextValue = {
	language: Language;
	setLanguage: (language: Language) => void;
	t: (text: string, values?: Record<string, string | number>) => string;
};
const LanguageContext = createContext<LanguageContextValue>({
	language: 'en',
	setLanguage: () => {},
	t: (text) => text,
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
	const language = useSyncExternalStore(subscribe, getLanguage, getServerLanguage);
	useEffect(() => {
		document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
	}, [language]);
	const setLanguage = useCallback((next: Language) => {
		try {
			window.localStorage.setItem(storageKey, next);
			temporaryLanguage = null;
		} catch {
			temporaryLanguage = next;
		}
		window.dispatchEvent(new Event(changeEvent));
	}, []);
	const t = useCallback(
		(text: string, values?: Record<string, string | number>) =>
			translateText(text, language).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key) =>
				values && Object.hasOwn(values, key) ? String(values[key]) : match,
			),
		[language],
	);
	const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
	return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);
export const T = ({ value }: { value: string | null | undefined }) => {
	const { t } = useLanguage();
	return value == null ? null : t(value);
};
