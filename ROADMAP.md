<!--
SPDX-FileCopyrightText: 2026 Auto Ontology Plus contributors
SPDX-License-Identifier: Apache-2.0
-->

# Auto Ontology Plus 开发路线图

业务系统、报表和智能体需要对“客户”“收入”“有效订单”等概念有一致的解释。Plus 的目标是让业务负责人能定义、审核和发布这些口径，让数据工程师能维护它们与各系统的映射，让管理员能追溯变更与访问。本页按可验收的业务结果划分版本。[项目说明](./README.md) · [上游起点](https://github.com/NVIDIA/auto-ontology/tree/d7e553e4c18112479c78b8f846e9929c4b5ed0a3)

## v0.1　跑通一个公开业务场景

**验收目标**　从空环境接入合成订单和退货数据，分别审核销售、财务对“本月收入”的定义。用同一账号在网页和一个 MCP 客户端以中英文查询，核对实际引用的定义、时间范围与金额。一次采集或编译失败应能用关联编号定位。[v0.1 里程碑与实时进度](https://github.com/yzmw123/auto-ontology-plus/milestone/1)

| 任务 | 可检查的交付物 | 依赖 |
| --- | --- | --- |
| [#1 合成业务场景与参考答案](https://github.com/yzmw123/auto-ontology-plus/issues/1) | 可重建的数据、两种收入口径、双语问题及独立参考结果，覆盖跨期退货与重复计算。 | 可先行 |
| [#2 连接器能力矩阵](https://github.com/yzmw123/auto-ontology-plus/issues/2) | 以 PostgreSQL 为对照，优先试点 Oracle。记录两种引擎在采集、查询、只读范围和失败诊断上的实测结果。 | #1 |
| [#3 多语名称与检索](https://github.com/yzmw123/auto-ontology-plus/issues/3) | 同一概念的中英文名称与别名指向同一标识，能显示缺译和审核状态。 | #1 |
| [#4 业务口径审核](https://github.com/yzmw123/auto-ontology-plus/issues/4) | 负责人能查看依据并审核；指定部门时选对口径，条件不足时提示澄清。 | #1 |
| [#5 基础日志与审核事件](https://github.com/yzmw123/auto-ontology-plus/issues/5) | 按编号定位接入、编译失败与审核结果，验证脱敏和日志可见范围。 | 可先行 |
| [#6 网页与 MCP 端到端验收](https://github.com/yzmw123/auto-ontology-plus/issues/6) | 发布可复跑的演练与逐项结果，包含已知差异和首次试用反馈。 | #1 至 #5 |

## v0.2　让一个部门持续维护本体

- **规则与变更。** 为业务域指定负责人，展示修改差异和受影响指标，支持审核发布、版本引用与回退。用字段改名和编译失败验收，确认人工修订和当前可用版本得到保留。[增量更新 #258](https://github.com/NVIDIA/auto-ontology/issues/258) · [人工修订 #259](https://github.com/NVIDIA/auto-ontology/issues/259) · [认证发布 #268](https://github.com/NVIDIA/auto-ontology/issues/268)
- **权限与审计。** 按业务域和数据源控制访问，记录权限变更、规则编辑和发布。用两种角色从 Web、API 和 MCP 验证允许与拒绝的结果；管理员可以查出谁在何时修改了哪个版本。[访问范围 #427](https://github.com/NVIDIA/auto-ontology/issues/427) · [变更审计 #269](https://github.com/NVIDIA/auto-ontology/issues/269)

## v0.3　验证跨团队复用

- **第二个部门与数据源。** 在另一个业务域复用场景模板和连接器测试，验证跨系统的实体映射、关系来源和聚合粒度。按试用需求扩展引擎与语种，公开兼容矩阵及已知限制。[连接器需求 #517](https://github.com/NVIDIA/auto-ontology/issues/517) · [关系依据 #260](https://github.com/NVIDIA/auto-ontology/issues/260) · [避免汇总重复 #263](https://github.com/NVIDIA/auto-ontology/issues/263)
- **应用与智能体。** 扩展“查口径、看依据、上报冲突”的工作流，在两个独立入口检查认证状态和权限。记录典型任务的延迟、模型调用成本与失败率。[MCP 使用体验 #522](https://github.com/NVIDIA/auto-ontology/issues/522) · [质量、性能与成本 #261](https://github.com/NVIDIA/auto-ontology/issues/261)

## 如何选择下一项增强

优先处理会阻塞真实业务流程、能用公开样例复现、且有试用者愿意验收的问题。已有上游实现或待合并 PR 的功能优先做兼容验证；需要由 Plus 持续维护的业务流程单独立项。候选方向包括行列级权限、跨业务域实体对齐，以及从制度文档中提取带出处、可审核的规则。[业务规则 #535](https://github.com/NVIDIA/auto-ontology/issues/535) · [文档依据 #527](https://github.com/NVIDIA/auto-ontology/issues/527) · [非结构化资料 #571](https://github.com/NVIDIA/auto-ontology/issues/571)

各版本记录同步的 NVIDIA 上游提交、Plus 增强、兼容环境和回归结果。开发进度以本仓库的开放及已关闭 Issues 为准。[跟踪开发任务](https://github.com/yzmw123/auto-ontology-plus/issues)
