// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

'use client';

import { type ReactNode } from 'react';
import { BackPanelLayout } from '@/common/BackPanelLayout';
import { SettingsNav } from '@/components/settings/SettingsNav';

type SettingsPanelLayoutProps = {
	children: ReactNode;
	isAdmin: boolean;
};

export const SettingsPanelLayout = ({ children, isAdmin }: SettingsPanelLayoutProps) => (
	<BackPanelLayout
		panelAriaLabel="Settings sections"
		expandAriaLabel="Expand settings menu"
		collapseAriaLabel="Collapse settings menu"
		panel={<SettingsNav isAdmin={isAdmin} />}
	>
		{children}
	</BackPanelLayout>
);
