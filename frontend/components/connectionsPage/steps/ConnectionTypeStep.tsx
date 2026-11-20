// SPDX-FileCopyrightText: Copyright (c) 2024-2026, NVIDIA CORPORATION & AFFILIATES.
// All rights reserved.
// SPDX-License-Identifier: Apache-2.0

'use client';

import Image, { type StaticImageData } from 'next/image';
import clickhouse from '@/assets/images/databases/clickhouse.png';
import databricks from '@/assets/images/databases/databricks.png';
import heavydb from '@/assets/images/databases/heavydb.png';
import kyuubi from '@/assets/images/databases/kyuubi.png';
import mysql from '@/assets/images/databases/mysql.png';
import oracle from '@/assets/images/databases/oracle.png';
import postgresql from '@/assets/images/databases/postgresql.png';
import snowflake from '@/assets/images/databases/snowflake.png';
import trino from '@/assets/images/databases/trino.png';
import { OptionCard } from '@/components/connectionsPage/steps/OptionCard';
import { ConnectionType, connectionDisplayName } from '@/enums/connection';

export type ConnectionTypeStepProps = {
	onSelect: (type: ConnectionType) => void;
};

const CONNECTOR_TYPES = Object.values(ConnectionType).sort((a, b) =>
	connectionDisplayName[a].localeCompare(connectionDisplayName[b]),
);

const logos: Record<ConnectionType, StaticImageData> = {
	clickhouse,
	databricks,
	heavydb,
	kyuubi,
	mysql,
	oracle,
	postgresql,
	snowflake,
	trino,
};

export const ConnectionTypeStep = ({ onSelect }: ConnectionTypeStepProps) => (
	<div className="flex flex-col gap-3 p-2">
		<div className="grid grid-cols-2 gap-3">
			{CONNECTOR_TYPES.map((type) => (
				<OptionCard key={type} onClick={() => onSelect(type)}>
					<span className="grid size-16 place-items-center rounded-full border border-zinc-200 bg-white dark:border-zinc-600">
						<Image
							src={logos[type]}
							alt=""
							width={44}
							height={44}
							unoptimized
							className="size-11 object-contain"
						/>
					</span>
					<span className="text-sm font-medium text-heading dark:text-zinc-100">
						{connectionDisplayName[type]}
					</span>
				</OptionCard>
			))}
		</div>
	</div>
);
