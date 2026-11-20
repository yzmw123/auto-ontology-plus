// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import dayjs from 'dayjs';

export type DateInput = string | number | Date;

export const formatDate = (value: DateInput, format = 'MMM DD YYYY'): string =>
	dayjs(value).format(format);

export const formatLocalizedDate = (value: DateInput, locale: string): string => {
	const date = dayjs(value);
	if (!date.isValid()) return '—';
	return new Intl.DateTimeFormat(locale, {
		year: 'numeric',
		month: 'short',
		day: locale === 'en' ? '2-digit' : 'numeric',
	}).format(date.toDate());
};
