# 研究数据字典（DATA_DICTIONARY）

本文档描述「智能养老AI监测系统配置偏好与采纳意愿调查」平台在 Supabase（PostgreSQL）中的
数据结构、编码规则与导出约定，供数据整理、统计分析与复核使用。

---

## 0. 权威来源与文档性质

本文档按仓库中**实际存在**的数据库定义逐列编写，权威来源为：

| 文件 | 作用 |
|---|---|
| `supabase/schema.sql` | 单文件完整结构（表 / 约束 / 索引 / 视图 / 函数 / 种子数据） |
| `supabase/migrations/0001_init.sql` | 初始迁移：结构 |
| `supabase/migrations/0002_rls_policies.sql` | 行级安全（RLS）策略 |
| `supabase/migrations/0003_grants.sql` | 权限授予与回收（GRANT / REVOKE） |
| `supabase/README.md` | 建库步骤、安全模型、自检查询、事务语义 |

**重要：若本文档与上述 SQL 文件不一致，一律以 SQL 文件为准**，并回头修正本文档。
SQL 文件中的 `COMMENT ON` 才是字段语义的第一手说明。

本文档不引用、不复制任何真实项目 URL、密钥或凭据。

与本文档配套的其它文档：

- 本地开发与环境变量：[SETUP.md](./SETUP.md)
- 部署：[DEPLOYMENT.md](./DEPLOYMENT.md)
- 研究设计审查（含"数据记录字段的补充"一节）：[RESEARCH_NOTES.md](./RESEARCH_NOTES.md)

研究内容的权威来源是 V1.0 文件
`智能养老AI监测_问卷初稿与DCE实验设计_V1.docx`，其纯文本转录位于
`work/source/questionnaire-v1.txt`。第 5–6 节的编码表直接来自该文件与
`src/data/` 下的实现。

---

## 1. 通用约定

| 约定 | 说明 |
|---|---|
| 命名风格 | 数据库使用 `snake_case`；研究编码（`C1`、`T01`、`S1`）在库存文本时保留 V1.0 的大写写法 |
| 属性水平 | `x1` / `x2` / `x3` 一律存 `smallint` 的 **0 / 1**，与 V1.0 配置表完全一致。任何中文标签都只用于界面展示，**不参与统计计算** |
| 配置编码 | `profile_id` 等字段用正则 CHECK 限定为 `^C[1-8]$` |
| 任务编码 | `task_id` 用正则 CHECK 限定为 `^T(0[1-9]|1[0-2])$` |
| 卷别 | `block_id` / `assigned_block` 取值 `'A'` 或 `'B'` |
| Likert | 量表与 Q8 一律 `smallint` 的 1–5，通过 CHECK 限定 |
| 时间 | 一律 `timestamptz`，以 ISO 8601（UTC）写入 |
| 主键 | `participants.id` 用 `uuid`（`gen_random_uuid()`）；其余表用 `bigserial` 代理键 |
| **连接键** | **`participants.participant_id`（text）是所有表之间的通用连接键**；它是前端本地生成的匿名编号，不是 `participants.id` |
| 版本 | `participants.questionnaire_version` 与 `survey_sessions.questionnaire_version` 是 Pilot 数据与正式数据分离的依据 |
| 匿名性 | 库中不含姓名、身份证号、手机号或任何可直接识别个人的字段 |
| 摄像头 | 平台**不采集**任何摄像头/麦克风数据，数据库中没有也不应有音视频字段 |

**参与者端永不直连数据库。** `anon` 角色对所有表没有任何权限与策略（默认拒绝），
问卷数据只能经服务端 `POST /api/submit-survey` → `submit_survey()` 写入。

---

## 2. 数据库对象清单与关系

### 2.1 表

| 表名 | 粒度 | 每位参与者行数 | 作用 |
|---|---|---|---|
| `participants` | 参与者 | 1 | 匿名编号、版本、卷别、Q2–Q5 身份信息、同意状态、起止时间 |
| `dce_choices` | 一道 DCE 题 | 6 | 模块三选择记录（左右配置、属性快照、实际选中配置、作答时长） |
| `profile_ratings` | 一个被评价配置 | 4 | 模块四 12 个量表题评分 |
| `comprehension_checks` | 一道理解检查题 | 2 | 模块二 Q6/Q7 **首次**作答结果与重答次数 |
| `simulation_events` | 一次埋点事件 | 0–N | 模拟弹窗/情景体验的打开、关闭、完成等行为 |
| `survey_responses` | 一次提交 | 1 | 模块五总体评价 Q8–Q10 |
| `survey_sessions` | 一次提交尝试 | 1 起（追加式，可多行） | 版本、User-Agent、起止时间；重试留痕 |
| `questionnaire_versions` | 一个问卷版本 | — | 版本登记；服务端校验版本是否登记且启用 |
| `research_config` | 一个配置项 | — | 研究运行配置（自由键值对） |
| `research_admins` | 一个管理员邮箱 | — | 管理员白名单（决定谁能读取研究数据） |
| `custom_config_choices` | 参与者 | 1 | **模块六**（V1.0 之外新增）：自由设定的理想配置（三个开关 + 匹配编码 + 耗时） |

### 2.2 视图与函数

| 对象 | 类型 | 作用 |
|---|---|---|
| `analysis_long` | 视图 | **DCE 长表**：每题展开为 left / right 两行，含 `chosen` 布尔标记，可直接用于条件 logit / 混合 logit |
| `submit_survey(payload jsonb)` | 函数 | 唯一的写入通道：在**一个事务**内写入 7 张表；仅 `service_role` 可执行 |
| `is_research_admin()` | 函数 | 判断当前 JWT 邮箱是否在白名单；供 RLS 策略使用 |
| `is_research_admin_email(text)` | 函数 | 判断给定邮箱是否为管理员；仅 `service_role` 可执行 |

### 2.3 关系

```text
questionnaire_versions (id)
        │
        ├──< participants.questionnaire_version
        └──< survey_sessions.questionnaire_version

participants (participant_id  ← 所有表的连接键)
        ├──1:6──  dce_choices          ──► analysis_long 视图（1:12 长表）
        ├──1:4──  profile_ratings
        ├──1:2──  comprehension_checks
        ├──1:N──  simulation_events
        ├──1:1──  survey_responses
        └──1:N──  survey_sessions（追加式：每次提交尝试一行）

research_admins   （白名单，决定 authenticated 角色能否读取研究数据）
research_config   （独立键值表，不参与参与者数据连接）
```

外键统一为 `participant_id ... references public.participants (participant_id) on delete cascade`，
因此删除 `participants` 中一行会级联清理该参与者的全部子表数据
（`submit_survey()` 也依赖这一机制处理重试覆盖）。

---

## 3. 逐表字段字典

下表中"来源"指该字段在问卷/代码中的产生位置。
`约束` 一列按 `supabase/schema.sql` 的原文归纳。

### 3.1 `participants`

参与者主表：一人一行。

| 列名 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | 数据库内部代理主键；**分析时不要用它做连接** | 服务端 |
| `participant_id` | `text` | NOT NULL, **UNIQUE** | 匿名参与者编号（前端生成，8–128 字符），研究数据的唯一连接键，不含姓名/身份证号 | `createParticipantId()`（`src/lib/storage.ts`） |
| `questionnaire_version` | `text` | NOT NULL, REFERENCES `questionnaire_versions(id)` ON UPDATE CASCADE ON DELETE RESTRICT | 问卷版本（外键）。用于把 Pilot 数据与正式版数据分开分析，禁止混用 | `QUESTIONNAIRE_VERSION` |
| `consent_status` | `text` | NOT NULL, CHECK IN (`'pending'`,`'agreed'`,`'declined'`) | 知情同意状态。**实际入库的提交只会是 `agreed`**（`submit_survey()` 以 `coalesce(..., 'agreed')` 写入，且 zod 要求字面量 `agreed`） | Q1 |
| `age_group` | `text` | NOT NULL, CHECK IN (`'18-29'`,`'30-44'`,`'45-59'`,`'60-69'`,`'70+'`) | 年龄范围 | Q2 |
| `respondent_role` | `text` | NOT NULL, CHECK IN (`'older_adult'`,`'current_caregiver'`,`'prospective_caregiver'`,`'other'`) | 主要答题身份 | Q3 |
| `respondent_role_other` | `text` | NOT NULL DEFAULT `''` | 身份选"其他"时的说明文字；非"其他"时服务端置空 | Q3 |
| `ai_device_experience` | `text` | NOT NULL, CHECK IN (`'used'`,`'aware_not_used'`,`'unaware'`) | 是否了解 AI 养老监测设备 | Q4 |
| `caregiving_experience` | `text` | NOT NULL, CHECK IN (`'often'`,`'sometimes'`,`'never'`) | 是否有照护老人的经历 | Q5 |
| `assigned_block` | `text` | NOT NULL, CHECK IN (`'A'`,`'B'`) | 随机分配的 DCE 卷别：A 卷 = T01/T02/T03/T07/T08/T11；B 卷 = T04/T05/T06/T09/T10/T12 | `assignBlock()` |
| `prior_experience` | `boolean` | NOT NULL DEFAULT `false` | 是否在本问卷之前使用过独立"情景体验"页面（用于检验体验先后顺序的影响） | `readPriorExperience()` |
| `started_at` | `timestamptz` | NOT NULL | 会话开始时间 | `draft.startedAt` |
| `submitted_at` | `timestamptz` | NULL | 提交时间 | `draft.submittedAt` |
| `total_duration_ms` | `integer` | NULL | 客户端测得的整体填写时长（毫秒）= 提交时间 − 开始时间；缺失时为 `NULL` | `buildSubmission()` 计算 |
| `submission_status` | `text` | NOT NULL DEFAULT `'draft'`, CHECK IN (`'draft'`,`'submitted'`,`'failed'`) | `draft` = 服务端已见过但未完成；`submitted` = 已成功落库；`failed` = 写入异常。**只有 `submitted` 的数据应进入正式分析** | `SubmissionStatus` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | 记录写入时间 | 服务端 |

索引：`assigned_block`、`submission_status`、`questionnaire_version`。

**分析提示：**

- `respondent_role` 必须用于分组报告。V1.0 明确要求"不把照护者的偏好等同于老人本人的偏好"，
  因此不得把 `older_adult` 与 `current_caregiver` 合并成一个总体均值。
- `total_duration_ms` 是**客户端测量值**，只能作为答题负担（Pilot 检查项）的参考，
  不能当作精确计时。V1.0 要求 Pilot 后依据实测时长填写"预计填写时间"，该字段正是其依据。

### 3.2 `dce_choices`

模块三的 DCE 选择记录，**每位参与者在所分配卷别内恰好 6 行**。
这是条件 Logit / 混合 Logit 的核心数据表。

| 列名 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `id` | `bigserial` | PRIMARY KEY | 数据库内部代理键 | 服务端 |
| `participant_id` | `text` | NOT NULL, REFERENCES `participants(participant_id)` ON DELETE CASCADE | 参与者 | — |
| `task_id` | `text` | NOT NULL, CHECK `~ '^T(0[1-9]|1[0-2])$'` | 任务编号（V1.0 表 3） | `DceChoiceRecord.taskId` |
| `block_id` | `text` | NOT NULL, CHECK IN (`'A'`,`'B'`) | 该题所属卷别；服务端语义校验要求等于 `participants.assigned_block` | `DceChoiceRecord.blockId` |
| `task_display_order` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 6 | 该题在本卷中的**实际展示次序**（1–6，且必须构成 1–6 的完整排列）；用于控制题目顺序效应 | `DceTaskDisplayPlan.displayOrder` |
| `left_profile_id` | `text` | NOT NULL, CHECK `~ '^C[1-8]$'` | 画面**左侧**方案对应的配置编码。左右位置是随机化的，可能与 V1.0 任务表的方案A/方案B 顺序不同 | `DceTaskDisplayPlan.leftProfileId` |
| `right_profile_id` | `text` | NOT NULL, CHECK `~ '^C[1-8]$'` | 画面**右侧**方案对应的配置编码 | `DceTaskDisplayPlan.rightProfileId` |
| `selected_side` | `text` | NOT NULL, CHECK IN (`'left'`,`'right'`) | 参与者点击的位置（位置效应分析用） | `DceChoiceRecord.selectedSide` |
| `selected_profile_id` | `text` | NOT NULL, CHECK `~ '^C[1-8]$'` | **参与者实际选中的配置编码**（已消除左右位置影响）。条件 logit 的因变量由它推导 | `DceChoiceRecord.selectedProfileId` |
| `left_x1` | `smallint` | NOT NULL, CHECK IN (0,1) | 左侧配置的 X1 属性快照 | `leftProfileAttributes.X1` |
| `left_x2` | `smallint` | NOT NULL, CHECK IN (0,1) | 左侧配置的 X2 属性快照 | `leftProfileAttributes.X2` |
| `left_x3` | `smallint` | NOT NULL, CHECK IN (0,1) | 左侧配置的 X3 属性快照 | `leftProfileAttributes.X3` |
| `right_x1` | `smallint` | NOT NULL, CHECK IN (0,1) | 右侧配置的 X1 属性快照 | `rightProfileAttributes.X1` |
| `right_x2` | `smallint` | NOT NULL, CHECK IN (0,1) | 右侧配置的 X2 属性快照 | `rightProfileAttributes.X2` |
| `right_x3` | `smallint` | NOT NULL, CHECK IN (0,1) | 右侧配置的 X3 属性快照 | `rightProfileAttributes.X3` |
| `response_duration_ms` | `integer` | NOT NULL, CHECK >= 0 | 该题作答时长（毫秒），用于剔除不认真作答的样本（应用层上限 24 小时） | `DceChoiceRecord.responseDurationMs` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | 记录写入时间 | 服务端 |

表级约束（原文）：

```sql
constraint dce_choices_participant_task_key unique (participant_id, task_id)

-- 左右不能是同一配置（两方案必须可比较）
constraint dce_choices_distinct_alternatives check (left_profile_id <> right_profile_id)

-- 关键：记录的"选中的配置"必须与"所选一侧"指向的配置一致
constraint dce_choices_selected_matches_side check (
  (selected_side = 'left'  and selected_profile_id = left_profile_id) or
  (selected_side = 'right' and selected_profile_id = right_profile_id)
)
```

索引：`participant_id`、`block_id`、`task_id`。

应用层（`src/lib/validation/schemas.ts` 的 `validateSubmissionSemantics()`）另有一层
同等目的的校验，服务端**不信任客户端结果**。属性快照与配置编码的一致性由应用层校验
（`attrsLookValid()`，比对 `EXPECTED_PROFILE_ATTRS`），数据库层未对快照与编码的对应关系
建 CHECK 或触发器。

### 3.3 `profile_ratings`

模块四配置感知评价，**每位参与者 4 行**，每行 12 个评分列（宽表）。

| 列名 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `id` | `bigserial` | PRIMARY KEY | 数据库内部代理键 | 服务端 |
| `participant_id` | `text` | NOT NULL, REFERENCES `participants(participant_id)` ON DELETE CASCADE | 参与者 | — |
| `profile_id` | `text` | NOT NULL, CHECK `~ '^C[1-8]$'` | 被评价的配置 | `ProfileRatingRecord.profileId` |
| `x1` | `smallint` | NOT NULL, CHECK IN (0,1) | 该配置的 X1 | `ProfileRatingRecord.X1` |
| `x2` | `smallint` | NOT NULL, CHECK IN (0,1) | 该配置的 X2 | `ProfileRatingRecord.X2` |
| `x3` | `smallint` | NOT NULL, CHECK IN (0,1) | 该配置的 X3 | `ProfileRatingRecord.X3` |
| `rating_order` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 4 | 该配置在本问卷中的评价次序（1–4），用于控制评价顺序效应 | `ProfileRatingRecord.ratingOrder` |
| `s1` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 安全感题 S1 得分 | S1 |
| `s2` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 安全感题 S2 得分 | S2 |
| `s3` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 安全感题 S3 得分 | S3 |
| `p1` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 隐私担忧题 P1 得分（**越高越担忧**） | P1 |
| `p2` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 隐私担忧题 P2 得分（**越高越担忧**） | P2 |
| `p3` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 隐私担忧题 P3 得分（**越高越担忧**） | P3 |
| `a1` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 自主感题 A1 得分 | A1 |
| `a2` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 自主感题 A2 得分 | A2 |
| `a3` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 自主感题 A3 得分 | A3 |
| `i1` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 采纳意愿题 I1 得分 | I1 |
| `i2` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 采纳意愿题 I2 得分 | I2 |
| `i3` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 采纳意愿题 I3 得分 | I3 |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | 记录写入时间 | 服务端 |

表级约束（原文）：

```sql
constraint profile_ratings_participant_profile_key unique (participant_id, profile_id)
constraint profile_ratings_participant_order_key   unique (participant_id, rating_order)
```

两条唯一约束共同保证：同一参与者的 4 个被评价配置**互不相同**，且评价次序是 1–4 的完整排列。

**关键分析提醒（隐私担忧方向）：** `p1`–`p3` 分数越高表示**隐私担忧越强**。
计算构念得分时直接取均值即可，**不得**做 `6 − 得分` 之类的反向计分把它变成"隐私满意度"。
（该提醒也写在 `schema.sql` 对 `profile_ratings.p1` 的 `COMMENT ON COLUMN` 中。）
12 个题目的完整文本与记分方向见第 6 节。

### 3.4 `comprehension_checks`

模块二理解检查，**每位参与者 2 行**（Q6、Q7）。
按 V1.0 要求"后台记录首次答题结果"，因此答错后重答**不覆盖**首次结果。

| 列名 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `id` | `bigserial` | PRIMARY KEY | 数据库内部代理键 | 服务端 |
| `participant_id` | `text` | NOT NULL, REFERENCES `participants(participant_id)` ON DELETE CASCADE | 参与者 | — |
| `question_id` | `text` | NOT NULL, CHECK IN (`'Q6'`,`'Q7'`) | 理解检查题号 | `ComprehensionRecord.questionId` |
| `first_answer` | `text` | NOT NULL | **首次**作答所选选项的**文字标签**。由服务端根据 `first_answer_index` 还原，便于直接阅读 CSV | 服务端补充（`buildRpcPayload()` 的 `firstAnswer`） |
| `first_answer_index` | `smallint` | NOT NULL, CHECK >= 0 | **首次**作答所选选项索引（0 起） | `ComprehensionRecord.firstAnswerIndex` |
| `is_correct` | `boolean` | NOT NULL | 首次作答是否正确。**服务端会重新推导该值，不信任客户端上报** | 服务端复核 |
| `retry_count` | `smallint` | NOT NULL DEFAULT 0, CHECK >= 0 | 首次答错后重新作答的次数 | `ComprehensionRecord.retryCount` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | 记录写入时间 | 服务端 |

表级约束：`constraint comprehension_checks_participant_question_key unique (participant_id, question_id)`。

索引：`participant_id`。

正确答案的选项索引（0 起）：

| 题号 | 题干 | 正确选项索引 | 正确选项文字 |
|---|---|---|---|
| `Q6` | 理解检查："仅摘要信息"是指？ | 0 | 仅可查看简要提示 |
| `Q7` | 理解检查："异常触发详细监测"是指？ | 1 | 基础检测持续，异常时启动详细记录 |

**分析提示：** `first_answer_index` 与 `is_correct` 是 Pilot 的"属性理解"检查项。
答错后系统展示正确解释并允许继续，因此 `is_correct = false` **不**代表数据无效。

### 3.5 `simulation_events`

模拟使用行为埋点，0 到多行/人。该表是**行为日志**，不属于 DCE 或量表的研究变量，
不得用于替代任何选择/评分数据。

| 列名 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `id` | `bigserial` | PRIMARY KEY | 数据库内部代理键 | 服务端 |
| `participant_id` | `text` | NOT NULL, REFERENCES `participants(participant_id)` ON DELETE CASCADE | 参与者 | — |
| `task_id` | `text` | NULL, CHECK (`task_id IS NULL OR task_id ~ '^T(0[1-9]|1[0-2])$'`) | 若在 DCE 题目中打开模拟则记录题目编号；**独立"情景体验"页为空（`NULL`）** | `SimulationEventRecord.taskId` |
| `profile_id` | `text` | NOT NULL, CHECK `~ '^C[1-8]$'` | 该次模拟对应的配置 | `SimulationEventRecord.profileId` |
| `event_type` | `text` | NOT NULL, CHECK IN (`'open'`,`'close'`,`'complete'`,`'view_details'`,`'replay'`) | 事件类型 | `SimulationEventRecord.eventType` |
| `source` | `text` | NOT NULL, CHECK IN (`'dce'`,`'experience'`) | 来源：正式问卷内（`dce`）或独立情景体验页（`experience`） | `SimulationEventRecord.source` |
| `event_timestamp_ms` | `integer` | NOT NULL, CHECK >= 0 | 相对问卷开始时间的毫秒偏移（**不是绝对时间**），保留原始事件顺序 | `SimulationEventRecord.eventTimestampMs` |
| `duration_ms` | `integer` | NULL, CHECK (`duration_ms IS NULL OR duration_ms >= 0`) | 停留时长（毫秒），主要由 `close` 事件携带 | `SimulationEventRecord.durationMs` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | 记录写入时间 | 服务端 |

索引：`participant_id`、`profile_id`、`event_type`。

事件条数上限 500 是**应用层**约束（`schemas.ts` 中 `.max(500)`），数据库层无对应 CHECK。

**分析提示：** `source = 'experience'` 的事件表示参与者在正式问卷**之前或之外**使用过
情景体验页面，与 `participants.prior_experience = true` 相互印证。
做敏感性分析时应把 `prior_experience = true` 的参与者单独标记，因为它可能影响答题表现。

### 3.6 `survey_responses`

模块五总体评价，一人一行。

| 列名 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `id` | `bigserial` | PRIMARY KEY | 数据库内部代理键 | 服务端 |
| `participant_id` | `text` | NOT NULL, **UNIQUE**, REFERENCES `participants(participant_id)` ON DELETE CASCADE | 参与者（唯一约束自带唯一索引，无需另建索引） | — |
| `q8` | `smallint` | NOT NULL, CHECK BETWEEN 1 AND 5 | 总体采纳意愿，1 = 非常不同意 … 5 = 非常同意 | Q8 |
| `q9` | `text` | NOT NULL, CHECK IN (`'insufficient_detection'`,`'privacy_exposure'`,`'limited_autonomy'`,`'complex_operation'`,`'other'`) | 最担心的问题（单选） | Q9 |
| `q10` | `text` | NOT NULL DEFAULT `''` | 关于安全/隐私/自主性平衡的开放性建议；**可跳过，空串表示未填** | Q10 |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | 记录写入时间 | 服务端 |

**分析提示：** `q9` 与 `q8` 是**同期测量**，不能解释为因果。Q9 是单选题，
若需要多项统计，应说明这是设计限制。

### 3.7 `survey_sessions`

问卷会话记录（**追加式**）：同一 `participant_id` 若发生重试会留下多行，便于审计数据收集过程。
本表**没有** `participant_id` 唯一约束，取"最新一次"需按 `created_at` / `submitted_at` 排序。

| 列名 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `id` | `bigserial` | PRIMARY KEY | 数据库内部代理键 | 服务端 |
| `participant_id` | `text` | NOT NULL, REFERENCES `participants(participant_id)` ON DELETE CASCADE | 参与者 | — |
| `questionnaire_version` | `text` | NOT NULL, REFERENCES `questionnaire_versions(id)` ON UPDATE CASCADE ON DELETE RESTRICT | 本次会话使用的问卷版本 | `QUESTIONNAIRE_VERSION` |
| `prior_experience` | `boolean` | NOT NULL DEFAULT `false` | 是否在正式问卷之前使用过独立"情景体验"页面 | `readPriorExperience()` |
| `user_agent` | `text` | NULL | 提交时的 User-Agent，**仅用于设备/浏览器兼容性排查**，含少量技术信息，不得用于识别个人 | 请求头 `user-agent` |
| `started_at` | `timestamptz` | NOT NULL | 会话开始时间 | `draft.startedAt` |
| `submitted_at` | `timestamptz` | NULL | 提交时间 | `draft.submittedAt` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | 记录写入时间 | 服务端 |

索引：`participant_id`。

**注意：** `submit_survey()` 会**清空**其他子表在同一 `participant_id` 下的旧行，
但 `survey_sessions` **例外**——它保留历史行，不做删除。因此
"参与者主表 1 行 + 会话表 N 行"是正常现象，不是重复提交。

### 3.8 `questionnaire_versions`

版本登记表，用于把 Pilot 数据与正式版数据分开分析。

| 列名 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `id` | `text` | PRIMARY KEY | 版本号，例如 `V1.0`；必须与 `QUESTIONNAIRE_VERSION` 字面一致 | `src/data/questionnaire.ts` |
| `description` | `text` | NOT NULL DEFAULT `''` | 版本说明 | 研究团队 |
| `is_active` | `boolean` | NOT NULL DEFAULT `true` | 是否接受新数据。停用（`false`）后，该版本问卷的提交会被服务端拒绝，但历史数据保留 | 研究团队 |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | 记录写入时间 | 服务端 |

**种子数据：** `schema.sql` 会插入一行
`('V1.0', '初版问卷（模块一至模块五 + DCE A/B 卷各 6 题 + 每人 4 个配置评价）。', true)`。
**收集数据前必须确认该行存在且 `is_active = true`**，否则 `submit_survey()` 会拒绝写入。

```sql
select * from public.questionnaire_versions;   -- 应有一行 V1.0 / is_active = true
```

**为什么必须有这张表：** 版本号是唯一能把 Pilot 数据与正式数据分开的字段。
如果直接把两个阶段的记录混在一起分析，样本会包含不同措辞、不同任务配对的问卷，结果不可解释。
`participants` 与 `survey_sessions` 都带 `questionnaire_version`，任何导出都应先按该字段筛选。

### 3.9 `research_config`

研究运行配置（自由键值对，仅 `service_role` 与白名单管理员可写）。

| 列名 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `key` | `text` | PRIMARY KEY | 配置项标识 | 研究者手工插入 |
| `value` | `text` | **NOT NULL** | 配置值（字符串） | 研究者手工插入 |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT `now()` | 最后更新时间 | 服务端 |

**注意两点：**

1. `research_config` **不预置任何键**（`schema.sql` 有意不插入数据），
   以避免与代码中的常量产生两套"事实来源"。示例：
   `insert into public.research_config (key, value) values ('stage', 'pilot');`
2. 这张表**不镜像** `src/data/placeholders.ts` 中的 9 个待填写字段。
   那些字段（所属单位、伦理审批编号、研究联系人、数据保存期限等）目前
   **只存在于前端源码常量中**，没有对应的数据库表。
   详见 SETUP.md 第 6.1 节与 RESEARCH_NOTES.md B6。

**禁止**在本表中存放密钥、密码、数据库连接串或任何参与者数据。它只承载非敏感的运行信息
（例如当前处于 Pilot 还是正式发放阶段）。

### 3.10 `research_admins`（补充表）

管理员邮箱白名单。**只有此表内的邮箱**（Supabase Auth 登录后 JWT 中的 `email`）
才能通过 RLS 读取研究数据。初始数据必须由项目负责人手工插入。

| 列名 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `email` | `text` | PRIMARY KEY | 管理员登录邮箱。大小写不敏感（比较时统一 `lower()`），建议统一填小写 | 项目负责人手工插入 |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | 记录写入时间 | 服务端 |
| `note` | `text` | NOT NULL DEFAULT `''` | 备注（姓名/角色/加入原因），便于日后审计谁有数据访问权 | 项目负责人手工插入 |

另有唯一索引 `research_admins_email_lower_key on public.research_admins (lower(email))`，
防止 `Foo@x.com` 与 `foo@x.com` 同时存在绕过审计。

RLS：仅"已在白名单内"的管理员可 `SELECT`；**没有任何写策略**——
新增管理员必须经 `service_role`（服务端）或 Supabase SQL Editor 完成，
避免任何一位管理员自行提权。

---

### 3.11 `custom_config_choices`（模块六，V1.0 之外新增）

参与者自由设定的"理想配置"，每人一条。与 `dce_choices` 的区别：
DCE 记录**受约束权衡下的选择**，本表记录**不受约束时主动设定的理想**。

| 列 | 类型 | 约束 | 含义 | 来源 |
|---|---|---|---|---|
| `id` | bigserial | PK | 代理键 | 数据库生成 |
| `participant_id` | text | NOT NULL, UNIQUE, FK → `participants.participant_id`, ON DELETE CASCADE | 匿名参与者编号 | 前端生成 |
| `x1` | smallint | NOT NULL, CHECK in (0,1) | 共享层级：0=仅摘要 / 1=详细原始数据 | 开关 1 |
| `x2` | smallint | NOT NULL, CHECK in (0,1) | 共享对象：0=仅指定子女 / 1=子女+服务机构 | 开关 2 |
| `x3` | smallint | NOT NULL, CHECK in (0,1) | 详细监测方式：0=异常时 / 1=全天持续 | 开关 3 |
| `matched_profile_id` | text | CHECK `^C[1-8]$`，可空 | 由 (x1,x2,x3) 反查得到的配置编码 | 服务端计算 |
| `response_duration_ms` | integer | NOT NULL, ≥0 | 该部分作答耗时（毫秒） | 前端计时 |
| `created_at` | timestamptz | NOT NULL, 默认 now() | 写入时间 | 数据库生成 |

**要点**

- 8 种 (x1,x2,x3) 组合与 C1–C8 **一一对应**，因此 `matched_profile_id` 正常不应为空；
  允许 NULL 仅为兼容历史数据。
- 服务端会校验 `matched_profile_id` 与三个水平是否一致，防止客户端伪造。
- RLS 与其他研究数据表一致：**仅白名单管理员可读**，写入只经 `submit_survey()`。

**导出**

| 数据集 | 内容 |
|---|---|
| `custom_config` | 本表的完整导出（8 列） |
| `merged` | 宽表新增 5 列：`custom_x1`、`custom_x2`、`custom_x3`、`custom_matched_profile_id`、`custom_response_duration_ms` |

**手动导出（不写代码）**：Supabase → Table Editor → 选中 `custom_config_choices`
→ 右上角 **Export → CSV**，即可直接下载。其余各表同理。

## 4. 写入路径与事务语义

问卷数据**只能**经以下链路写入，不存在第二条通道：

```text
浏览器（匿名，无数据库权限）
   │  POST /api/submit-survey           （api/submit-survey.ts，Vercel Node 函数）
   ▼
服务端校验：方法 → 体积 → 限流 → zod 结构校验 → 研究语义校验 → 版本双重校验 → 重复提交检查
   │  supabase.rpc('submit_survey', { payload })    （service_role）
   ▼
PostgreSQL 单事务：校验版本已登记且启用 → 行锁查重 → 写 participants
   → 清空并重写 5 张子表 → 追加 survey_sessions → 返回最小回执
```

关键保证：

| 保证 | 实现方式 |
|---|---|
| 不允许半份数据 | 全部 7 张表的写入都在 `submit_survey()` 这**一个函数调用（一个事务）**内完成，任何一步失败整份回滚 |
| 不允许重复正式提交 | 函数内 `select ... for update` 行锁 + `participants.participant_id` 唯一约束，已 `submitted` 时抛 `23505`；服务端映射为 HTTP 409 |
| 客户端无法伪造结论 | 服务端重新执行 `submissionSchema` 与 `validateSubmissionSemantics()`；`is_correct` 也由服务端重新推导 |
| 匿名前端无法直接写库 | `anon` 对所有表无权限、无策略；`submit_survey()` 的执行权限只授予 `service_role` |
| 管理员无法悄悄改答案 | 研究数据表对 `authenticated` 只给 `SELECT`；只有 `research_config` 与 `questionnaire_versions` 允许写入 |

`submit_survey()` 返回的**最小回执**（不含任何答案内容）：
`participantId`、`questionnaireVersion`、`submissionStatus`、`dceChoices`（条数）、
`profileRatings`（条数）、`simulationEvents`（条数）。

`payload` 的键与前端 `SurveySubmission` 一致（camelCase），另有两个服务端补充键：
`comprehension[].firstAnswer`（由选项索引还原的选项文字）与 `userAgent`。

---

## 5. 实验设计编码表

本节是本研究操纵的完整定义，**不得修改**（见 RESEARCH_NOTES.md C 节）。

### 5.1 三个属性与水平编码

| 属性 | 编码 | 水平 0 | 水平 1 | 说明 |
|---|---|---|---|---|
| 共享层级 | `X1` | `0` = 仅摘要信息 | `1` = 详细原始数据 | 接收者能够查看的信息详细程度。水平 0 时接收者只看到"活动正常""疑似跌倒"等简要提示，不提供详细活动记录或视频 |
| 共享对象 | `X2` | `0` = 仅指定子女 | `1` = 指定子女及授权养老服务机构 | 允许查看监测信息的人员范围 |
| 详细监测方式 | `X3` | `0` = 异常时详细监测 | `1` = 全天持续详细监测 | 平时是否持续进行详细监测与记录 |

**关于 X3 的两个中文名称（务必注意）：** V1.0 同一份文件对 X3 使用了两个名称——
模块二属性表（表 1）、第二部分逻辑图、第三部分结果表二写作「**X3 监测时长**」，
模块三各题表格写作「**详细监测方式**」。两者指**同一个属性**，编码也完全相同
（0 = 异常触发详细监测，1 = 全天持续详细监测）。

- 本研究面向参与者界面统一使用「**详细监测方式**」（更能传达实际操纵内容，且与模块三措辞一致）；
- 数据库与代码统一使用 `x3` / `X3`；
- 本数据字典同时登记两个中文名称，避免后续分析时误以为存在两个不同的属性。
- 出处与待确认事项见 RESEARCH_NOTES.md B2 节。

**统一前提（必须在分析说明中保留）：** 所有方案的基础异常识别与报警能力相同；
云端处理/存储规则、价格、授权与暂停设置在各方案间保持一致；"详细监测"与
"向接收者共享详细信息"是两个不同概念。

### 5.2 C1–C8 配置表

严格采用 X1 × X2 × X3 的 2×2×2 全因子设计，8 个组合无重复、无缺失。
**逐字转录自 V1.0 模块三配置表（表 2），不得修改任何取值。**

| 配置 | X1 共享层级 | X2 共享对象 | X3 详细监测方式（监测时长） |
|---|---|---|---|
| `C1` | 0 | 0 | 0 |
| `C2` | 0 | 0 | 1 |
| `C3` | 0 | 1 | 1 |
| `C4` | 1 | 0 | 0 |
| `C5` | 1 | 0 | 1 |
| `C6` | 0 | 1 | 0 |
| `C7` | 1 | 1 | 0 |
| `C8` | 1 | 1 | 1 |

### 5.3 T01–T12 任务表

转录自 V1.0 模块三任务表（表 3）。表中的「方案A / 方案B」是 **V1.0 文档中的文本位置**，
不代表实际屏幕上的左右位置；实际左右顺序在每位参与者端独立随机交换（见第 7 节示例）。

| 任务 | 卷别 | 方案A（V1.0 文本） | 方案B（V1.0 文本） | 变化属性 | 结构类型 |
|---|---|---|---|---|---|
| `T01` | A 卷 | `C1` | `C3` | X2, X3 | 同向变化 |
| `T02` | A 卷 | `C1` | `C5` | X1, X3 | 同向变化 |
| `T03` | A 卷 | `C1` | `C7` | X1, X2 | 同向变化 |
| `T04` | B 卷 | `C2` | `C4` | X1, X3 | 替代权衡 |
| `T05` | B 卷 | `C2` | `C6` | X2, X3 | 替代权衡 |
| `T06` | B 卷 | `C2` | `C8` | X1, X2 | 同向变化 |
| `T07` | A 卷 | `C3` | `C5` | X1, X2 | 替代权衡 |
| `T08` | A 卷 | `C3` | `C7` | X1, X3 | 替代权衡 |
| `T09` | B 卷 | `C4` | `C6` | X1, X2 | 替代权衡 |
| `T10` | B 卷 | `C4` | `C8` | X2, X3 | 同向变化 |
| `T11` | A 卷 | `C5` | `C7` | X2, X3 | 替代权衡 |
| `T12` | B 卷 | `C6` | `C8` | X1, X3 | 同向变化 |

分卷汇总：

| 卷别 | 任务编号 | 同向变化题 | 替代权衡题 |
|---|---|---|---|
| A 卷 | T01、T02、T03、T07、T08、T11 | T01、T02、T03（3 题） | T07、T08、T11（3 题） |
| B 卷 | T04、T05、T06、T09、T10、T12 | T06、T10、T12（3 题） | T04、T05、T09（3 题） |

设计性质（由 `checkDesignIntegrity()` 程序化校验，并由 `npm test` 覆盖）：

- 每卷恰好 6 题，且**每位参与者只回答 1 卷**（随机分卷）；
- 每卷三个主效应差分矩阵秩 = 3（参数可识别）；
- 每卷每个属性的 0 与 1 各出现 6 次（水平平衡）；
- 每题恰好 2 个属性发生变化；
- A 卷只涉及 C1/C3/C5/C7，B 卷只涉及 C2/C4/C6/C8；全 12 题中 8 个配置各出现 3 次。

**重要：** A 卷与 B 卷的任务内容不同，因此**不应**直接比较"卷 A 更偏好某属性"而不控制设计差异。
`changed_attributes` 与 `structure_type` 是**内部审计字段**（仅存在于代码
`src/data/dceTasks.ts`，**没有**对应的数据库列），不向参与者展示，也不参与面向参与者的文案。

### 5.4 理解检查编码

| `question_id` | 题干 | 选项（索引 0 起） | 正确答案索引 |
|---|---|---|---|
| `Q6` | 理解检查："仅摘要信息"是指？ | 0 仅可查看简要提示 / 1 可查看完整视频 / 2 系统不能识别异常 | 0 |
| `Q7` | 理解检查："异常触发详细监测"是指？ | 0 平时完全不检测 / 1 基础检测持续，异常时启动详细记录 / 2 全天持续详细记录 | 1 |

答错时展示正确解释并允许重新阅读后继续；数据库只记录**首次**作答结果与重答次数。

### 5.5 身份与总体评价枚举编码

| 变量 | 字段 | 编码 | 中文标签 |
|---|---|---|---|
| Q2 年龄范围 | `age_group` | `18-29` / `30-44` / `45-59` / `60-69` / `70+` | 18–29岁 / 30–44岁 / 45–59岁 / 60–69岁 / 70岁及以上 |
| Q3 答题身份 | `respondent_role` | `older_adult` | 老年人本人 |
| | | `current_caregiver` | 当前家庭照护者 |
| | | `prospective_caregiver` | 潜在家庭照护者 |
| | | `other` | 其他（`respondent_role_other` 存说明文字） |
| Q4 设备了解程度 | `ai_device_experience` | `used` / `aware_not_used` / `unaware` | 使用过 / 了解但未使用 / 不了解 |
| Q5 照护经历 | `caregiving_experience` | `often` / `sometimes` / `never` | 经常 / 偶尔 / 没有 |
| Q9 最担心的问题 | `q9` | `insufficient_detection` | 安全风险识别不足 |
| | | `privacy_exposure` | 个人隐私暴露 |
| | | `limited_autonomy` | 老人自主性受限 |
| | | `complex_operation` | 操作复杂 |
| | | `other` | 其他 |
| 同意状态 | `consent_status` | `pending` / `agreed` / `declined` | 待选择 / 同意 / 不同意（入库的提交只会有 `agreed`） |
| 提交状态 | `submission_status` | `draft` / `submitted` / `failed` | 草稿 / 已提交 / 失败 |
| 模拟事件类型 | `event_type` | `open` / `close` / `complete` / `view_details` / `replay` | 打开 / 关闭 / 完成 / 查看详情 / 重播 |
| 埋点来源 | `source` | `dce` / `experience` | 正式问卷内 / 独立情景体验页 |

---

## 6. 量表题编码（S1–S3 / P1–P3 / A1–A3 / I1–I3）

模块四对每一个被评价配置回答同样 12 个评分题，5 点 Likert：
**1 = 非常不同意，2 = 不同意，3 = 一般，4 = 同意，5 = 非常同意。**

### 6.1 构念与题项归属

| 构念 | 代码 | 中文名称 | 题项 | 记分方向 |
|---|---|---|---|---|
| `security` | M1 | 安全感 | S1、S2、S3 | 分数越高表示安全感越强 |
| `privacy` | M2 | 隐私担忧 | P1、P2、P3 | **分数越高表示隐私担忧越强（不得反向计分为隐私满意度）** |
| `autonomy` | M3 | 自主感 | A1、A2、A3 | 分数越高表示自主感越强 |
| `intention` | — | 采纳意愿 | I1、I2、I3 | 分数越高表示采纳意愿越强 |

### 6.2 完整题目文本与库中列名

题目措辞逐字转录自 V1.0 模块四量表（表 16），**一字未改**。

| 题号 | 库中列名 | 构念 | 题目 |
|---|---|---|---|
| `S1` | `s1` | 安全感 | 我认为该系统能够及时发现老人可能发生的安全风险。 |
| `S2` | `s2` | 安全感 | 我认为该系统能够在发生紧急情况时提供有效的安全保障。 |
| `S3` | `s3` | 安全感 | 使用该系统会让我对老人的居家安全更加放心。 |
| `P1` | `p1` | 隐私担忧 | 我担心该系统收集或共享了过多的老人个人信息。 |
| `P2` | `p2` | 隐私担忧 | 我担心该系统会使老人的私人生活受到过度关注。 |
| `P3` | `p3` | 隐私担忧 | 我担心该系统中的个人信息被不必要的人员查看。 |
| `A1` | `a1` | 自主感 | 我认为老人使用该系统后，仍然能够自主安排日常生活。 |
| `A2` | `a2` | 自主感 | 我认为该系统不会过度干预老人的个人生活。 |
| `A3` | `a3` | 自主感 | 我认为老人能够对自己的监测和信息共享方式保持控制权。 |
| `I1` | `i1` | 采纳意愿 | 如果该系统实际可用，我愿意选择或为老人配置该系统。 |
| `I2` | `i2` | 采纳意愿 | 我愿意在实际养老照护中长期使用该系统。 |
| `I3` | `i3` | 采纳意愿 | 如果有类似养老需求，我愿意推荐使用该系统。 |

### 6.3 构念得分计算

```text
security_mean        = mean(s1, s2, s3)     -- 越高越有安全感
privacy_concern_mean = mean(p1, p2, p3)     -- 越高越担忧隐私
autonomy_mean        = mean(a1, a2, a3)     -- 越高越自主
intention_mean       = mean(i1, i2, i3)     -- 采纳意愿越强
```

四个构念的题项都是**同一方向**，因此计算均值时**不需要任何反向计分**。

### 6.4 关键提醒：P1–P3 不得反向计分

**这是本项目最容易出错的地方，单独列出：**

- P1–P3 测的是「**隐私担忧**」，量表刻度方向是"同意程度"。
  参与者选 5（非常同意"我担心……"）表示**担忧最强**。
- 因此 `privacy_concern_mean` 数值越高 = 隐私担忧越强，**这个方向本身就是正确的研究变量**。
- **禁止**把 P1–P3 反向计分为"隐私满意度"（例如 `6 − p1`）。
  一旦反向计分，构念名称、系数符号与结果解释全部会反向，属于实质性研究错误。
- 同理，也不要把"安全感高"与"隐私担忧高"当成同向指标；两者是不同甚至可能冲突的构念。
- 代码中的方向声明位于 `src/data/scales.ts` 的 `CONSTRUCTS[].direction`；
  数据库中的方向声明位于 `schema.sql` 对 `profile_ratings.p1` 的 `COMMENT ON COLUMN`。
  两处都可作为复核依据。

**其它相关提醒（来自 V1.0 与 RESEARCH_NOTES.md）：**

- 12 个题项均为**自编初稿**，信度、区分度与内容效度**尚未检验**，须在 Pilot 中检查
  （天花板/地板效应、内部一致性）；分析时不得声称已验证。
- A3 依赖"自主控制权限"这一在配置间**未被操纵**的定义。实现上向所有配置固定展示同一句
  "所有配置均提供相同的授权与暂停设置"，以避免参与者把 A3 理解为配置间差异。

---

## 7. DCE 选择记录的完整示例

下面给出**同一位参与者**在 A 卷下的 6 条 `dce_choices` 记录。
这是**用于说明字段含义的示例数据，不是真实研究数据**。

参与者（示例）：

| 字段 | 值 |
|---|---|
| `participant_id` | `3f1c8b30-9a4e-4d7a-9b2c-51e0f7ad2c11`（示例编号） |
| `assigned_block` | `A` |
| `questionnaire_version` | `V1.0` |
| A 卷任务 | T01、T02、T03、T07、T08、T11 |

本示例中随机化的结果（题目顺序 + 每题左右交换）：

| `task_display_order` | `task_id` | V1.0 配对 | 实际左 | 实际右 | 是否发生左右交换 |
|---|---|---|---|---|---|
| 1 | `T07` | C3 / C5 | `C5` | `C3` | 是 |
| 2 | `T02` | C1 / C5 | `C1` | `C5` | 否 |
| 3 | `T11` | C5 / C7 | `C7` | `C5` | 是 |
| 4 | `T01` | C1 / C3 | `C1` | `C3` | 否 |
| 5 | `T08` | C3 / C7 | `C3` | `C7` | 否 |
| 6 | `T03` | C1 / C7 | `C7` | `C1` | 是 |

对应的 6 条数据库记录（`block_id` 全为 `'A'`；属性快照已按 C1–C8 定义展开：
C1 = (0,0,0)，C3 = (0,1,1)，C5 = (1,0,1)，C7 = (1,1,0)）：

| `task_display_order` | `task_id` | `left_profile_id` | 左 (x1,x2,x3) | `right_profile_id` | 右 (x1,x2,x3) | `selected_side` | `selected_profile_id` | `response_duration_ms` |
|---|---|---|---|---|---|---|---|---|
| 1 | `T07` | `C5` | (1,0,1) | `C3` | (0,1,1) | `right` | `C3` | 8432 |
| 2 | `T02` | `C1` | (0,0,0) | `C5` | (1,0,1) | `left` | `C1` | 11205 |
| 3 | `T11` | `C7` | (1,1,0) | `C5` | (1,0,1) | `left` | `C7` | 15670 |
| 4 | `T01` | `C1` | (0,0,0) | `C3` | (0,1,1) | `right` | `C3` | 9214 |
| 5 | `T08` | `C3` | (0,1,1) | `C7` | (1,1,0) | `left` | `C3` | 13880 |
| 6 | `T03` | `C7` | (1,1,0) | `C1` | (0,0,0) | `right` | `C1` | 10050 |

该参与者的真实选择（消除位置影响后）为：
`C3`（第 1 题）、`C1`（第 2 题）、`C7`（第 3 题）、`C3`（第 4 题）、`C3`（第 5 题）、`C1`（第 6 题）。

数据库会额外强制两条一致性（否则该行无法插入，
`dce_choices_selected_matches_side` 与 `dce_choices_distinct_alternatives`）：

- 第 1 行的 `selected_side = 'right'`，因此 `selected_profile_id` 必须等于
  `right_profile_id = 'C3'`——示例中正是如此；
- 每一行的 `left_profile_id <> right_profile_id`。

### 7.1 为什么必须记录 `selected_profile_id`，而不能只记"方案A"

1. **屏幕上没有稳定的"方案A"。** V1.0 文档里的"方案A/方案B"是文档的文本位置；
   实现时每题的左右顺序独立随机交换（`buildTaskDisplayPlan()`）。
   在上面的示例里，T07 的"方案A"（C3）实际上显示在**右侧**。
   一条只写"选了方案A"的记录，没有任何可分析含义——它既不是配置，也不是位置。

2. **区分三种不同的东西。** 一条选择记录里同时存在三个概念，缺一不可：

   | 概念 | 字段 | 含义 |
   |---|---|---|
   | 屏幕位置 | `selected_side` | 参与者点了左边还是右边（**位置效应**分析用） |
   | 实际配置 | `selected_profile_id` | 被选中的 C1–C8 配置（**属性偏好**分析用，条件 logit 的因变量） |
   | 属性向量 | `left_x1..x3` / `right_x1..x3` | 两个备选方案的属性组合（**条件 Logit** 的自变量） |

3. **条件 Logit / 混合 Logit 需要被选中方案的属性向量。**
   模型的自变量是"被选中选项的 X1/X2/X3"。`analysis_long` 视图正是用
   `(alt.profile_id = c.selected_profile_id)` 生成 `chosen` 标记；
   如果只有"方案A"，在交换过左右的题目上就会取到错误的属性向量，系数符号直接反向。

4. **数据必须自解释、可审计。**
   `schema.sql` 对 `dce_choices` 的表注释写明：左右两侧属性水平均为快照，
   以便在配置编码被修订后仍可复现当时的实验材料。
   属性快照与 `selected_profile_id` 一起存储后，每一条记录都能独立还原
   "当时屏幕上是什么、参与者选了什么"，不依赖事后重新运行随机化代码。
   若只存位置并依赖代码重算，一旦任务表、随机化算法或配对关系变更，历史数据就无法解释。

5. **一致性由数据库与应用层双重强制。**
   数据库用 `dce_choices_selected_matches_side` 保证
   `selected_profile_id` 一定等于所选一侧的配置；
   服务端 `validateSubmissionSemantics()` 还会拒绝左右相同的记录、
   属性快照与配置编码不符的记录，以及不属于所分配卷别的题目。

6. **不要用 V1.0 的"方案A/方案B"做分析连接键。**
   代码中保留的 `profileA` / `profileB`（`src/data/dceTasks.ts`）只表示 V1.0 文档里的文本位置，
   用于校验配对关系；它们**不是**展示位置，也**不是**分析变量，
   而且**没有**写入数据库。

---

## 8. 长表（long format）导出与表连接

### 8.1 连接键：`participants.participant_id`

所有参与者级表格都以 **`participants.participant_id`（text）** 作为通用连接键。
注意它不是 `participants.id`（`uuid` 代理键）；子表只存 `participant_id`。

### 8.2 DCE 长表：直接用 `analysis_long` 视图

`dce_choices` 是"一人一题一行"的宽表（每题两个方案是列）。
`analysis_long` 视图已经把每题展开为 left / right 两行，并给出 `chosen` 布尔列，
**这是 DCE 分析的标准入口**，不需要自己写 `cross join lateral`：

| 视图列 | 含义 |
|---|---|
| `participant_id` | 参与者（连接键） |
| `questionnaire_version` | 问卷版本（来自 `participants`，已 join 进来） |
| `assigned_block` | 卷别（视图内为 `dce_choices.block_id` 的别名） |
| `task_id` | 任务编号 |
| `task_display_order` | 展示次序（1–6） |
| `alternative` | `'left'` 或 `'right'` |
| `profile_id` | 该备选方案的配置编码 |
| `x1` / `x2` / `x3` | 该备选方案的属性水平 |
| `chosen` | 布尔值：该备选方案是否被选中（`profile_id = selected_profile_id`） |
| `response_duration_ms` | 本题作答时长 |

视图定义（原文摘要）：

```sql
create view public.analysis_long
with (security_invoker = true)
as
select
  c.participant_id,
  p.questionnaire_version,
  c.block_id               as assigned_block,
  c.task_id,
  c.task_display_order,
  alt.alternative,
  alt.profile_id,
  alt.x1, alt.x2, alt.x3,
  (alt.profile_id = c.selected_profile_id) as chosen,
  c.response_duration_ms
from public.dce_choices c
join public.participants p on p.participant_id = c.participant_id
cross join lateral (
  values
    ('left'::text,  c.left_profile_id,  c.left_x1,  c.left_x2,  c.left_x3),
    ('right'::text, c.right_profile_id, c.right_x1, c.right_x2, c.right_x3)
) as alt (alternative, profile_id, x1, x2, x3);
```

每位参与者产生 **6 题 × 2 = 12 行**，每题恰好 1 行 `chosen = true`，可直接用于
`clogit` / `mlogit` / 混合 Logit。

```sql
-- 只分析已正式提交、且属于 V1.0 的数据
select l.*
  from public.analysis_long l
  join public.participants p on p.participant_id = l.participant_id
 where p.submission_status = 'submitted'
   and p.questionnaire_version = 'V1.0';
```

> 兼容性提示：`with (security_invoker = true)` 需要 PostgreSQL 15+。
> 低版本请按 `supabase/README.md` 第 3 节的说明删除该行后重建视图；
> 底表 RLS 与对 `anon` 的 `REVOKE` 仍然提供保护。

### 8.3 配置评分长表：宽表转长表

`profile_ratings` 没有对应视图，需要把 12 个评分列转成
"一人一配置一题一行"（每位参与者 4 配置 × 12 题 = 48 行）：

```sql
select
  r.participant_id,
  r.profile_id,
  r.rating_order,
  r.x1, r.x2, r.x3,
  item.item_id,
  item.construct,
  item.score
from public.profile_ratings r
cross join lateral (
  values
    ('S1','security', r.s1), ('S2','security', r.s2), ('S3','security', r.s3),
    ('P1','privacy',  r.p1), ('P2','privacy',  r.p2), ('P3','privacy',  r.p3),
    ('A1','autonomy', r.a1), ('A2','autonomy', r.a2), ('A3','autonomy', r.a3),
    ('I1','intention',r.i1), ('I2','intention',r.i2), ('I3','intention',r.i3)
) as item(item_id, construct, score)
order by r.participant_id, r.rating_order, item.item_id;
```

按构念聚合（注意 `privacy_concern_mean` 越高 = 担忧越强，**不做反向计分**）：

```sql
select
  participant_id, profile_id, x1, x2, x3,
  avg(score) filter (where construct = 'security')  as security_mean,
  avg(score) filter (where construct = 'privacy')   as privacy_concern_mean,
  avg(score) filter (where construct = 'autonomy')  as autonomy_mean,
  avg(score) filter (where construct = 'intention') as intention_mean
from (
  /* 上一条 SQL 作为子查询 */
) t
group by participant_id, profile_id, x1, x2, x3;
```

### 8.4 连接陷阱：不要直接 join 明细表

`dce_choices` 是 6 行/人，`profile_ratings` 是 4 行/人，`comprehension_checks` 是 2 行/人。
如果把它们直接 join 到同一张 participant 级结果上，会产生 6 × 4 × 2 = 48 行的
**笛卡尔积**，把样本量放大 48 倍。

正确做法二选一：

1. 分别导出明细表，在统计软件（R / Stata / Python）里按各自的分析粒度使用；
   DCE 用 `analysis_long`，量表用 8.3 的长表，两者按 `participant_id` 在分析阶段合并。
2. 若必须在一张表里合并，先各自聚合到 participant 粒度再 join：

```sql
with dce as (
  select participant_id,
         count(*)                                       as dce_task_count,
         count(*) filter (where selected_side = 'left')  as left_choice_count
  from public.dce_choices
  group by participant_id
),
ratings as (
  select participant_id,
         count(*)                     as rated_profile_count,
         avg((s1 + s2 + s3) / 3.0)     as security_mean,
         avg((p1 + p2 + p3) / 3.0)     as privacy_concern_mean,
         avg((a1 + a2 + a3) / 3.0)     as autonomy_mean,
         avg((i1 + i2 + i3) / 3.0)     as intention_mean
  from public.profile_ratings
  group by participant_id
)
select p.participant_id, p.respondent_role, p.assigned_block,
       dce.dce_task_count, dce.left_choice_count,
       ratings.rated_profile_count,
       ratings.security_mean, ratings.privacy_concern_mean,
       ratings.autonomy_mean, ratings.intention_mean
from public.participants p
left join dce     on dce.participant_id     = p.participant_id
left join ratings on ratings.participant_id = p.participant_id
where p.submission_status = 'submitted';
```

### 8.5 导出通道

| 通道 | 说明 |
|---|---|
| `analysis_long` 视图 + SQL 查询 | 推荐用于 DCE 分析；随 `schema.sql` 创建 |
| 后台接口 `GET /api/admin/export?dataset=<name>` | `api/admin/export.ts`。**需登录且邮箱在 `research_admins` 白名单内**（`Authorization: Bearer <Supabase Auth access_token>`）；匿名返回 `401`，非白名单返回 `403` |
| Supabase 控制台 → Table Editor → Export CSV | 手工导出，适合小批量核对 |
| `psql \copy` | 适合大批量与可复现的导出脚本 |

`dataset` 可选值（`api/admin/export.ts` 中的 `DATASET_ALIASES`）：

| `dataset` | 导出内容 |
|---|---|
| `participants` | 参与者主表 |
| `dce_choices` | DCE 原始选择记录（6 行/人） |
| `profile_ratings` | 4 个配置 × 12 量表题评分 |
| `analysis_long`（别名 `long_format`） | DCE 长表（每题 2 行，含 `chosen`） |
| `merged` | **每人一行**的宽表：参与者信息 + Q8–Q10 + 四个构念的量表均值 + DCE 题数 + 已评配置数 |

CSV 约定（`api/admin/export.ts` 实现）：

- UTF-8 **带 BOM**，Excel 打开中文不乱码；
- RFC 4180：字段用双引号包裹，内部双引号转义为 `""`，行分隔为 CRLF；
- 空值输出为 `""`（而不是 `NULL`）；
- 以 `=` `+` `-` `@` 开头的文本会被加上前置单引号，防止 Excel 公式注入；
- 列顺序固定（各 `*_COLUMNS` 常量），便于用同一份分析脚本反复读取；
- 单页读取 1000 行；单次导出行数上限 200000，超过时提示分批导出。

> `merged` 数据集已经把"每人一行"的合并逻辑实现好了，**优先使用它**，
> 以避免第 8.4 节所述的明细表连接笛卡尔积问题。
> 无论通过哪个通道，导出的原始记录都应是上述表/视图的直接投影，
> 不得在其中重新计算或替换研究变量。导出文件属于**原始研究数据**，
> 应存放在受控目录，不要放进任何 Git 仓库。

### 8.6 导出前的标准筛选

| 目的 | 建议筛选条件 |
|---|---|
| 只取已完成提交的记录 | `participants.submission_status = 'submitted'` |
| 只取某一版本（Pilot 或正式） | `participants.questionnaire_version = '<版本号>'` |
| 只取正式版且未预先体验过 | 加 `and p.prior_experience = false` |
| 按身份分组报告 | `group by respondent_role`（**不得**把老人本人与照护者合并） |
| 位置效应检查 | 统计 `selected_side = 'left'` 的比例，按 `task_id` 分别看 |
| 数据完整性 | 每人恰好 6 条 `dce_choices`、4 条 `profile_ratings`、2 条 `comprehension_checks`、1 条 `survey_responses` |

---

## 9. 数据质量检查清单（导出后执行）

1. **完整性**：每位提交者 6 条 `dce_choices`、4 条 `profile_ratings`、2 条 `comprehension_checks`、
   1 条 `survey_responses`。
2. **卷别一致**：所有 `dce_choices.block_id` = 该参与者的 `assigned_block`，
   且题目集合恰好等于该卷的 6 个 `task_id`。
3. **展示顺序**：`task_display_order` 是 1–6 的完整排列；`rating_order` 是 1–4 的完整排列。
4. **选中一致性**：`selected_profile_id` = 所选一侧的 `*_profile_id`；
   左右配置不同；属性快照与 C1–C8 定义一致。
5. **配置不重复**：同一参与者的 4 个 `profile_id` 互不相同。
6. **水平取值**：所有 `x1`/`x2`/`x3` ∈ {0,1}；所有量表得分 ∈ {1,2,3,4,5}。
7. **时间合理性**：`submitted_at` ≥ `started_at`；`response_duration_ms` 无异常负值。
8. **理解检查**：`is_correct` 与 `first_answer_index` 指向的选项一致（服务端已重新推导）。
9. **版本一致性**：同一次分析中不混用多个 `questionnaire_version`；
   确认 `questionnaire_versions` 中该版本行存在。
10. **位置效应**：逐题查看左侧选择率，作为 Pilot 检查项记录，不要静默忽略。

第 1–4、6–8 项在提交时已由 `api/submit-survey.ts`（zod + 语义校验）与
`submit_survey()`（数据库约束 + 单事务）强制执行；导出后仍应独立复核一遍。
