<!--
SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES.
SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
SPDX-License-Identifier: Apache-2.0
本社区版本重新编写了中文项目介绍。上游英文说明保存在 README.en.md。
-->

# Auto Ontology Plus

**面向企业业务场景的本体管理与应用。** Auto Ontology Plus 是基于 NVIDIA Auto Ontology 独立维护的社区增强版。我们希望业务负责人、数据工程师和 AI 应用能共用经过审核的概念、指标和关系。项目计划扩展多语种、数据源接入、业务规则管理、权限与审计。[开发路线图](./ROADMAP.md) · [v0.1 里程碑](https://github.com/yzmw123/auto-ontology-plus/milestone/1) · [English upstream guide](./README.en.md)

## 本期更新（待发布）

- **新增**　管理员可以接入 Oracle，在探索图中维护字段连线和术语分类，并让问答沿这些关系查数。数据分析页支持按时间、用户名和渠道筛选，点击一行即可查看完整问题、思考说明和 SQL。
- **优化**　发现页打开即可浏览目录。术语详情页可悬停问号，查看实体、区域和相关术语的说明。编辑连线时先并排选两张表，再逐对选择匹配字段。分析列表使用单行显示，导出时沿用当前筛选范围。
- **解决 Bug**　修复了已配置环境数据源时数据库连接入口被隐藏的问题，并补齐了中文界面中筛选项、面包屑、关系详情和分析表头的英文残留。

详细变化和升级说明见[发布记录](./CHANGELOG.md)。

## 从一个业务问题开始

“本月收入是多少？”销售部门按下单时间统计订单金额，财务部门按入账时间统计扣除退货后的金额。两种答案都可能正确。要让报表和智能体用对口径，系统需要知道谁在问、适用哪种定义、何时生效，以及能用哪些数据核对。

v0.1 将用一套公开的合成订单与退货数据演示这个过程。数据工程师接入数据并检查采集结果，业务负责人审核两条定义和依据，使用者再从网页或 MCP 客户端用中英文查询。验收时会核对两个入口引用的定义、范围和计算结果。[首版场景任务](https://github.com/yzmw123/auto-ontology-plus/issues/1) · [端到端验收任务](https://github.com/yzmw123/auto-ontology-plus/issues/6)

<a id="how-it-works"></a>

## 当前可用的上游能力

本仓库从 NVIDIA 的 `d7e553e` 起步。当前代码可用于采集数据库元数据，生成业务术语、字段映射、关系和 SQL 指标；业务人员可以审查并认证定义，应用可以通过 REST API、CLI 和只读 MCP 使用本体。上游还提供角色权限、单点登录、Ossie 模型交换，以及安装、管理、查询三套 Agent Skills。[工作原理](./README.en.md#how-it-works) · [认证与权限](./docs/authentication.md) · [MCP 接入](./docs/mcp.md) · [Agent Skills](./skills)

| 使用目的 | 规划中的 Plus 增强 |
| --- | --- |
| 多个地区共用指标 | 为同一概念维护多语名称、别名与审核状态；地区口径不同时展示适用范围。 |
| 接入新的业务系统 | 扩展数据库类型，公布各引擎对元数据、采样、查询和刷新的支持情况。 |
| 让业务负责人维护口径 | 记录规则的依据、负责人、粒度和生效时间，逐步支持变更影响分析、发布和回退。 |
| 管理访问并排查问题 | 在网页、API 与 MCP 验证访问范围，按请求编号关联接入、编译日志和业务操作记录。 |

Plus 的功能开发从 v0.1 里程碑开始。每项任务都列有可复现的验收条件。[查看六项开发任务](https://github.com/yzmw123/auto-ontology-plus/milestone/1)

<a id="quickstart"></a>

## 运行现有示例

1. 克隆本仓库，准备 Docker Compose v2、`uv` 和模型服务密钥。将根目录的 `.env.example` 复制为 `.env`，设置 `AUTH_SECRET`、应用地址、模型密钥和各服务密码。[配置示例](./.env.example)
2. 在仓库根目录运行 `docker compose up -d --wait postgres`。按英文快速开始的第 2 步，在专用演示库载入 Wide World Importers 样例，使用与 `.env` 一致的数据库密码。[样例载入命令](./README.en.md#quickstart)
3. 运行 `docker compose up -d --build`，打开 [本地应用](http://localhost:3000)，使用配置的管理员账号登录。在 **Settings → Semantic Compilation** 开启语义编译，状态就绪后进入 **Chat** 试问样例问题。[样例问题与参考结果](./README.en.md#quickstart)

<a id="models"></a>

集群部署可使用 Helm。模型端点、密钥与各模型角色在配置文件中分别指定。[部署指南](./DEPLOYMENT.md) · [模型配置](./README.en.md#models) · [数据源连接](./docs/connections.md)

## 参与项目

欢迎提交具体业务场景、语言样例、数据库兼容性结果和复现记录。请写清使用环境、预期口径与实际结果，并使用可公开的样例数据。开发任务在本仓库跟踪；适合 NVIDIA 上游的通用改动，按其贡献流程沟通。[本项目 Issues](https://github.com/yzmw123/auto-ontology-plus/issues) · [上游贡献指南](https://github.com/NVIDIA/auto-ontology/blob/main/CONTRIBUTING.md)

本项目沿用 Apache-2.0 许可证，保留 NVIDIA 及第三方声明。[LICENSE](./LICENSE) · [第三方声明](./THIRD_PARTY_NOTICES.md) · [容器组件声明](./CONTAINER_THIRD_PARTY_NOTICES.md) · [NVIDIA 原项目](https://github.com/NVIDIA/auto-ontology)
