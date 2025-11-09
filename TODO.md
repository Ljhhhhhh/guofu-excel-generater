# TODO 计划板

- [ ] 填写当前迭代的目标、子任务与负责人。
- [ ] 在任务开始前更新状态（例如：`进行中`、`阻塞`），完成后勾选并注明结果或链接。
- [ ] 记录重要的决策、待确认事项，并在获得答复后更新条目。

> 请所有协作者在推进工作前先查看并维护本文件，确保项目规划始终同步。如需新增章节，可按日期或里程碑拆分。

## 当前迭代（2025-11-15 ~ 2025-11-30）

- [ ] 【待开始】运行链路 E2E：将 RunReportModal & Step3 测试面板接入主进程日志/输出展示，提供“打开文件/复制路径”以及运行失败的精确提示。（Owner: 待定）
- [ ] 【待开始】ConfigList 全模式支持：补全 `fixed` / `column` 表单与字段映射 UI，确保与 doc 中表头/列映射要求一致。（Owner: 待定）
- [ ] 【待开始】依赖与运行文档：在 `doc/doc.md` 或新技术文档说明 LibreOffice 依赖、运行输出目录、清理策略，并更新 README 运行说明。（Owner: 待定）
- [ ] 【待开始】主进程测试：补齐报表运行/模板解析链路的单元+集成测试，覆盖数据抽取、参数缺失、模板缺失等场景。（Owner: 待定）
- [ ] 【进行中】参数标记配置指导：梳理 Step2 配置面板需求，输出模板参数标记添加方法与注意事项。（Owner: Codex，2025-11-15）
- [x] 【完成】RunReportModal 运行链路：接入 runtime API，校验参数/数据源并触发实际 `contracts:run` 生成输出，支持复制输出路径与状态提示。（Owner: Codex，2025-11-15）

## 2025-11-08

- [x] 【完成】模板解析服务：在主进程实现 `templateService.parseTemplate`，使用 `exceljs` 扫描 Carbone 标记并生成 MarkItem，解析失败需定位到具体工作表与单元格；并通过 IPC 暴露给 Step1 实际调用。（Codex，2025-11-08）
- [x] 【完成】排查模板上传后待配置清单未能获取 Carbone mark 信息的问题，修复 Step2 使用嵌套 ref 导致 markItems 始终为空的缺陷。（Codex，2025-11-08）
- [x] 【完成】根据 Carbone 规范修正模板解析正则，确保能识别 `{d.xxx}` 与 `{{ d.xxx }}` 等标记并继续分类。（Codex，2025-11-08）

## 2025-11-09

- [x] 【完成】修复 `templateService` 的 Carbone 标记匹配，识别 `{d.}/{c.}` 数据标记并忽略 `{#}/{t()}/{o.}` 控制标签，避免误报。（Codex，2025-11-09）
- [x] 【完成】排查上传模板中 `{d.reportTitle}` 标记解析失败的问题，修复模板解析正则与表达式截取逻辑。（Codex，2025-11-08）

## 2025-11-10

- [x] 【完成】Carbone 模板解析规则强化：通过 context7 学习官方规范，并在 `templateService` 中优化列表循环标记识别（含 i/i+1 过滤逻辑），确保 `[i+1]` 示例行不再出现在待配置列表。（Codex，2025-11-10）
- [x] 【完成】列表字段配置面板：简化为“表头名”文本框，结合所选标记自动推导字段，仅需录入 Excel 表头即可完成映射。（Codex，2025-11-10）

## 2025-11-11

- [x] 【完成】Step2 `ConfigList` 配置面板 UI 重构：梳理必填项、重组卡片+两栏布局，并统一操作区交互视觉。（Codex，2025-11-11）

### Node 后端任务拆解

- [x] 模板解析服务：在主进程实现 `templateService.parseTemplate`，使用 `exceljs` 扫描 Carbone 标记并生成 MarkItem；解析失败需返回精确位置。（Owner: Codex，2025-11-08）
- [x] 【完成】文件存储规范：在主进程实现模板存储服务，落盘到 `userData/storage/templates/<uuid>/` 并写入 checksum，更新 IPC + CRUD ，渲染层使用自有路径。（Codex，2025-11-08）
- [x] 【完成】运行数据文件管理：实现 runtime 存储服务+IPC，Step3/运行流程均通过主进程复制文件并提供会话清理策略，避免 renderer 直接读写文件。（Codex，2025-11-08）
- [x] 【完成】数据抽取工具：实现单值/列表/列模式的数据读取 util（ExcelDataExtractor），覆盖 header/fixed/column 三种 rangeMethod 并输出友好错误提示。（Codex，2025-11-11）
- [x] 【完成】报表运行器：实现主进程 `runContractReport`，串联 `exceljs` 数据抽取、`carbone` 模板渲染与 `execa` 环境检测，提供参数校验、日志记录与错误定位能力。（Codex，2025-11-11）
- [x] 【完成】IPC 扩展：新增 `templates:parse`、`contracts:test`、`contracts:run` 渠道并同步 preload API，Step3/运行模态均可直接调用主进程报表运行服务。（Codex，2025-11-11）
- [x] 【完成】资源清理：契约删除或模板替换时自动移除模板文件及 runtime 目录，确保无垃圾文件残留。（Codex，2025-11-08）
- [ ] 测试与验证：编写主进程层面的单元/集成测试，模拟上传模板、创建契约、运行报表的 E2E 流程，并整理技术文档。（Owner: 待定）
