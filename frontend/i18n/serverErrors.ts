// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0

type Locale = 'zh' | 'ko' | 'ja' | 'es';
type ErrorPattern = {
	pattern: RegExp;
	translations: Record<Locale, string>;
};

// Match known server messages exactly and retain their variable details.
const patterns: ErrorPattern[] = [
	{
		pattern: /^Failed to delete (SQL|PQL) analysis$/,
		translations: {
			zh: '删除 {1} 分析失败',
			ko: '{1} 분석 삭제 실패',
			ja: '{1} 分析の削除に失敗しました',
			es: 'No se pudo eliminar el análisis {1}',
		},
	},
	{
		pattern: /^Failed to update (SQL|PQL) analysis$/,
		translations: {
			zh: '更新 {1} 分析失败',
			ko: '{1} 분석 업데이트 실패',
			ja: '{1} 分析の更新に失敗しました',
			es: 'No se pudo actualizar el análisis {1}',
		},
	},
	{
		pattern: /^Failed to create (SQL|PQL) analysis$/,
		translations: {
			zh: '创建 {1} 分析失败',
			ko: '{1} 분석 생성 실패',
			ja: '{1} 分析の作成に失敗しました',
			es: 'No se pudo crear el análisis {1}',
		},
	},
	{
		pattern: /^Failed to create connection: ([\s\S]+)$/,
		translations: {
			zh: '创建连接失败：{1}',
			ko: '연결 생성 실패: {1}',
			ja: '接続の作成に失敗しました：{1}',
			es: 'No se pudo crear la conexión: {1}',
		},
	},
	{
		pattern: /^Failed to update connection: ([\s\S]+)$/,
		translations: {
			zh: '更新连接失败：{1}',
			ko: '연결 업데이트 실패: {1}',
			ja: '接続の更新に失敗しました：{1}',
			es: 'No se pudo actualizar la conexión: {1}',
		},
	},
	{
		pattern: /^Failed to delete connection: ([\s\S]+)$/,
		translations: {
			zh: '删除连接失败：{1}',
			ko: '연결 삭제 실패: {1}',
			ja: '接続の削除に失敗しました：{1}',
			es: 'No se pudo eliminar la conexión: {1}',
		},
	},
	{
		pattern: /^Cannot express this model as Apache Ossie YAML: ([\s\S]+)$/,
		translations: {
			zh: '无法将此模型转换为 Apache Ossie YAML：{1}',
			ko: '이 모델을 Apache Ossie YAML로 변환할 수 없습니다: {1}',
			ja: 'このモデルを Apache Ossie YAML に変換できません：{1}',
			es: 'No se puede convertir este modelo a YAML de Apache Ossie: {1}',
		},
	},
	{
		pattern: /^Cannot read this file as Apache Ossie YAML: ([\s\S]+)$/,
		translations: {
			zh: '无法将此文件作为 Apache Ossie YAML 读取：{1}',
			ko: '이 파일을 Apache Ossie YAML로 읽을 수 없습니다: {1}',
			ja: 'このファイルを Apache Ossie YAML として読み込めません：{1}',
			es: 'No se puede leer este archivo como YAML de Apache Ossie: {1}',
		},
	},
	{
		pattern: /^Group name must be at most (\d+) characters$/,
		translations: {
			zh: '用户组名称最多允许 {1} 个字符',
			ko: '그룹 이름은 {1}자 이하여야 합니다',
			ja: 'グループ名は {1} 文字以内にしてください',
			es: 'El nombre del grupo debe tener como máximo {1} caracteres',
		},
	},
	{
		pattern: /^Tag name must be at most (\d+) characters$/,
		translations: {
			zh: '标签名称最多允许 {1} 个字符',
			ko: '태그 이름은 {1}자 이하여야 합니다',
			ja: 'タグ名は {1} 文字以内にしてください',
			es: 'El nombre de la etiqueta debe tener como máximo {1} caracteres',
		},
	},
	{
		pattern: /^Rule search term must be at least (\d+) characters$/,
		translations: {
			zh: '规则搜索词至少需要 {1} 个字符',
			ko: '규칙 검색어는 {1}자 이상이어야 합니다',
			ja: 'ルールの検索語は {1} 文字以上にしてください',
			es: 'El término de búsqueda de la regla debe tener al menos {1} caracteres',
		},
	},
	{
		pattern: /^Timeout must be a whole number of seconds from (\d+) to (\d+)\.$/,
		translations: {
			zh: '超时时间必须为 {1} 到 {2} 秒之间的整数。',
			ko: '시간 제한은 {1}~{2}초 사이의 정수여야 합니다.',
			ja: 'タイムアウトは {1}～{2} 秒の整数にしてください。',
			es: 'El tiempo de espera debe ser un número entero de segundos entre {1} y {2}.',
		},
	},
	{
		pattern: /^(CustomAnalysis|PqlAnalysis|SqlAttribute) (.+) not found$/,
		translations: {
			zh: '未找到 {1}：{2}',
			ko: '{1}을(를) 찾을 수 없습니다: {2}',
			ja: '{1} が見つかりません：{2}',
			es: 'No se encontró {1}: {2}',
		},
	},
	{
		pattern: /^Group color must be one of: ([\s\S]+)$/,
		translations: {
			zh: '用户组颜色必须是以下选项之一：{1}',
			ko: '그룹 색상은 다음 중 하나여야 합니다: {1}',
			ja: 'グループの色は次のいずれかにしてください：{1}',
			es: 'El color del grupo debe ser uno de los siguientes: {1}',
		},
	},
	{
		pattern: /^Tag (.+) is not on (.+) (.+)$/,
		translations: {
			zh: '{2} {3} 没有标签 {1}',
			ko: '{2} {3}에 태그 {1}이(가) 없습니다',
			ja: '{2} {3} にタグ {1} は付いていません',
			es: 'La etiqueta {1} no está asignada a {2} {3}',
		},
	},
];

export const translateServerError = (message: string, language: Locale): string | undefined => {
	for (const { pattern, translations } of patterns) {
		const match = pattern.exec(message);
		if (match) {
			return translations[language].replace(
				/\{(\d+)\}/g,
				(_, index: string) => match[Number(index)],
			);
		}
	}
	return undefined;
};
