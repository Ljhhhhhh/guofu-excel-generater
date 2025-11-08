# 运行数据文件管理方案

## 1. 存储根目录

所有测试与正式运行产生的文件都位于

```
<userData>/storage/runtime/
```

根路径下按照「主体类型 + 作用域 + 会话」三级目录划分，确保不同契约、不同阶段互不干扰。

## 2. 目录结构

```
runtime/
├── drafts/                       # 未保存契约/草稿专用
│   └── <draftId>/
│       └── tests/
│           └── <sessionId>/
│               └── data-sources/<dataSourceId>/<fileName>.xlsx
├── contracts/                    # 已保存契约
│   └── <contractId>/
│       ├── tests/<sessionId>/data-sources/...
│       └── runs/<sessionId>/data-sources/...
```

- **drafts**：Step3 测试或草稿阶段生成的临时文件，契约保存成功后会自动清理原 draft 目录。
- **contracts**：Dashboard 运行 / 已保存契约的测试数据，按 `tests` 和 `runs` 分开。
- **sessionId**：由主进程生成的 UUID。session 目录内会记录 `session.meta.json` 用于追踪元信息。

## 3. Runtime API

通过 `window.api.runtime` 间接访问主进程，全部操作由主进程完成，渲染进程只负责传递文件路径：

| 方法 | 说明 |
| --- | --- |
| `createSession(scopeId, scopeType, sessionType)` | 创建运行会话并落盘目录。 |
| `storeDataSourceFile(session, dataSourceId, sourcePath)` | 将用户上传的 Excel 复制到会话目录并返回 checksum。 |
| `cleanupSession(session)` | 手动清理指定会话（Step3 离开/运行完成后调用）。 |
| `cleanupScope(scope)` | 按契约或草稿维度清空所有运行文件（契约删除、模板替换等场景）。 |

> 渲染层永远不直接访问磁盘，所有路径均由主进程维护。

## 4. 清理策略

1. **按规则自动过期**：创建新 session 前会执行一次巡检。
   - drafts 下的 tests/runs：默认保留 24 小时。
   - contracts 下的 tests：保留 7 天；runs：保留 30 天。
2. **事件驱动清理**：
   - 契约删除：删除模板文件，并调用 `cleanupScope({ contractId })`。
   - 模板替换：更新数据库成功后，删除旧模板 + 清空该契约的 runtime 目录。
   - 草稿保存为契约：store 内在保存成功后清理原 draft scope。

上述策略确保磁盘不会积累无主文件，且不同阶段的数据天然隔离。
