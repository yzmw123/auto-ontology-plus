// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

'use client';

import { Button } from '@/common/Button';
import { Size, ButtonTheme } from '@/enums/button';
import { Icon, IconName } from '@/common/icons';
import { ExplorationLayer } from '@/enums/exploration';
import { useLanguage } from '@/i18n/LanguageProvider';

type ViewToggleProps = {
	layer: ExplorationLayer;
	onToggle: () => void;
};

export const ViewToggle = ({ layer, onToggle }: ViewToggleProps) => {
	const { t } = useLanguage();
	const isSemantic = layer === ExplorationLayer.Semantic;

	return (
		<Button
			theme={ButtonTheme.Primary}
			size={Size.LARGE}
			type="button"
			onClick={onToggle}
			iconPosition="left"
			shadow
		>
			<Icon name={isSemantic ? IconName.Database : IconName.Terms} className="h-4 w-4" />
			{isSemantic ? t('Switch to Data Objects') : t('Switch to Semantic Objects')}
		</Button>
	);
};
