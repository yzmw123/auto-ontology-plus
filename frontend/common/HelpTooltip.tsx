// SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
// SPDX-License-Identifier: Apache-2.0

import { Tooltip } from '@nvidia/foundations-react-core';
import type { ReactElement } from 'react';

export const HelpTooltip = ({
	text,
	align = 'start',
	children,
}: {
	text: string;
	align?: 'start' | 'end';
	children: ReactElement;
}) => (
	<Tooltip
		slotContent={text}
		side="bottom"
		align={align}
		openDelayDuration={250}
		className="z-[1000] max-w-[min(20rem,90vw)] whitespace-normal rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-body shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
	>
		{children}
	</Tooltip>
);
