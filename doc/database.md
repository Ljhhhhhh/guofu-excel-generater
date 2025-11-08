# 数据库方案

本项目需要在 Electron 主进程中持久化“报表契约”及其关联配置。根据 `src/shared/types/contract.ts`
里的类型定义以及《doc/doc.md》的交互规范，数据库需要覆盖以下信息：

- **报表契约 (`ReportContract`)：** 契约元信息与模板文件引用。
- **数据源 (`DataSource`)：** 契约声明的所有数据源及顺序。
- **单值绑定 (`SingleValueBinding`)：** 单元格绑定的具体来源。
- **列表绑定 (`ListBinding`)：** 表头/列映射、数据范围等复杂配置。
- **运行时参数 (`ParameterDefinition`)：** 运行时的输入提示与默认值。

## 1. 存储位置

- 引擎：`better-sqlite3`（同步、线程安全，适合 Electron 主进程）。
- 文件：`<userData>/storage/report-contracts.db`，确保对每个系统用户隔离。
- PRAGMA：启用 `WAL` 模式提升并发读取性能。

## 2. 表结构

| 表 | 说明 |
| --- | --- |
| `report_contracts` | 契约基础信息，关联模板文件。 |
| `data_sources` | 某契约声明的所有数据源；支持排序。 |
| `single_value_bindings` | `SingleValueBinding` 类型。 |
| `list_bindings` | `ListBinding` 类型的公共部分。 |
| `list_field_mappings` | `list_bindings` 对应的字段-表头映射。 |
| `parameter_definitions` | `ParameterDefinition` 类型。 |

### 2.1 `report_contracts`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT PK | UUID。 |
| `name` | TEXT | 报表名称。 |
| `description` | TEXT | 描述。 |
| `template_path` | TEXT | 模板在磁盘中的绝对路径。 |
| `template_file_name` | TEXT | 原始文件名。 |
| `template_checksum` | TEXT | 模板文件的 SHA-256 校验值，用于变更检测与去重。 |
| `created_at` / `updated_at` | TEXT | ISO 时间字符串。 |

### 2.2 `data_sources`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT PK | 数据源 ID。 |
| `contract_id` | TEXT FK | `report_contracts.id`。 |
| `name` | TEXT | 友好名称。 |
| `sort_order` | INTEGER | UI 展示顺序。 |

### 2.3 `single_value_bindings`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT PK | UUID。 |
| `contract_id` | TEXT FK | `report_contracts.id`。 |
| `mark` | TEXT UNIQUE | 模板标记。 |
| `data_source_id` | TEXT FK | `data_sources.id`。 |
| `sheet_name` | TEXT | 工作表。 |
| `cell_coordinate` | TEXT | 单元格坐标。 |
| `data_type` | TEXT | `'auto'|'text'|'number'|'date'`。 |

### 2.4 `list_bindings`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT PK | UUID。 |
| `contract_id` | TEXT FK | 契约 ID。 |
| `mark` | TEXT UNIQUE | 模板列表标记。 |
| `data_source_id` | TEXT FK | 数据源。 |
| `sheet_name` | TEXT | 工作表。 |
| `range_method` | TEXT | `'header'|'fixed'|'column'`。 |
| `header_row` | INTEGER | range_method=`header` 时使用。 |
| `data_start_row` | INTEGER | range_method=`header` 时的起始行。 |
| `fixed_range` | TEXT | range_method=`fixed` 时的范围。 |
| `columns_json` | TEXT | range_method=`column` 的列数组（JSON 字符串）。 |

### 2.5 `list_field_mappings`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | INTEGER PK AUTOINCREMENT | |
| `list_binding_id` | TEXT FK | `list_bindings.id`。 |
| `field_name` | TEXT | 模板字段名，例如 `item.name`。 |
| `header_text` | TEXT | 数据源表头文本。 |
| `sort_order` | INTEGER | 与模板中出现顺序一致。 |

### 2.6 `parameter_definitions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT PK | UUID。 |
| `contract_id` | TEXT FK | 契约 ID。 |
| `mark` | TEXT UNIQUE | 参数标记（如 `v.report_month`）。 |
| `display_label` | TEXT | UI 展示标签。 |
| `data_type` | TEXT | `'text'|'number'|'date'`。 |
| `default_value` | TEXT | 默认值，可空。 |

## 3. 数据流

1. **创建契约**：主进程将解析器结果（模板/标记列表）写入以上表；渲染进程通过 IPC 读取。
2. **编辑契约**：根据契约 ID 查询基础数据 + 绑定表；更新时使用事务确保父子记录一致。
3. **运行报表**：读取契约 + 数据源 + 运行时参数定义，驱动上传/输入 UI，并将最终配置发给报表引擎。

## 4. 初始化策略

- 在 `app.whenReady()` 后初始化数据库：
  1. 计算文件路径，确保目录存在。
  2. 打开 `better-sqlite3` 连接，设置 PRAGMA。
  3. 运行建表语句（使用事务 + `CREATE TABLE IF NOT EXISTS`）。
- 退出时关闭连接，防止文件句柄泄漏。

此方案已在 `src/main/database` 中落地，实现自动建表与连接生命周期管理。
