# dsh-chat-memory-ingest

[English](#english) | **简体中文**

> 把已经导出的微信 / QQ 聊天记录，按主人 / 他人分流，编排进桌宠的长期记忆。

`dsh-chat-memory-ingest` 是一个 DSH 插件，负责**导入与编排**，不负责解密、不内置导出工具：

```text
微信 / QQ 已导出文件
        ↓  同步到 inbox
memory-classify（切块、分流、归类）
        ↓
cognitive-memory / Mnemosyne（长期记忆）
```

它适合把**过去已经导出**的聊天记录补进记忆库，让桌宠在之后的对话里能回顾共同经历、偏好和关系变化。

---

## 它解决什么问题

聊天记录通常很长、格式不统一，而且同时包含“主人说的话”和“对方说的话”。如果直接整段丢进记忆库：

- 分不清哪句是主人说的，哪句是对方说的；
- 一条长对话被切成没有上下文的碎片；
- 重复导入同一份导出，产生重复记忆；
- 旧聊天里的称呼、时间、关系状态被当成现在的事实。

这个插件把流程拆成：**同步 → 预览 → 分流切块 → 导入 → 可选 digest**，每一步都可以先看结果再写库。

## 边界：它不做什么

- **不解密**微信 / QQ 的私有数据库；
- **不内置** `wechat-chat-export` / `qq-chat-exporter`，只通过配置引用本机工具目录；
- **不替代** `cognitive-memory` 服务，导入最终仍由桌宠的记忆管线处理；
- 不保证导出格式永远不变；导出工具升级后先用 `im_preview` 验证。

---

## 前置条件

| 项 | 要求 |
| --- | --- |
| DSH | Node.js ≥ 20，支持 `dsh plugin add` |
| 宿主 | **MurasamePet 兼容**的桌宠项目根，需存在 `Murasame/`、`config.json`、`services/cognitive-memory/` 等 |
| Python | 桌宠 `.venv` 中的 Python，或通过 `PET_PYTHON` 指定 |
| 微信导出 | `wechat-chat-export` 生成的 `chat_full_parsed.json` |
| QQ 导出 | QQChatExporter 的 TXT，或 `.qce_spool_*.jsonl` |
| 记忆服务 | 桌宠的 `cognitive-memory` 已可正常读写 |

> 这不是一个可以脱离桌宠宿主单独运行的通用“聊天导入器”；`python/cli.py` 会 import 宿主的 `Murasame.*` 与 `memory_classify_assist` 模块。

---

## 安装

### 从 GitHub 安装

```bash
dsh plugin --profile web add github:DSH-Raising-Plan/dsh-chat-memory-ingest
```

### 本地开发（link）

在 profile 的 `package.json` 中：

```json
{
  "dependencies": {
    "dsh-chat-memory-ingest": "link:D:/path/to/dsh-chat-memory-ingest"
  },
  "dsh": {
    "profile": {
      "bundles": ["dsh-chat-memory-ingest"]
    }
  }
}
```

然后在 profile 目录执行：

```bash
pnpm install
```

可选环境变量：

- `PET_ROOT`：桌宠项目根；默认按插件所在位置向上推断；
- `PET_PYTHON`：运行 `python/cli.py` 的 Python；默认使用桌宠 `.venv`。

---

## 配置

在桌宠 `config.json` 中加入：

```json
"memory_classify_assist": {
  "chat_ingest": {
    "enable": true,
    "plugin_root": "_dsh_plugins/dsh-chat-memory-ingest",
    "wechat_tool_root": "外部github工具包/wechat-chat-export-main",
    "qq_tool_root": "外部github工具包/qq-chat-exporter-master",
    "qq_exports_dir": "",
    "owner_aliases": []
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `enable` | 是否启用聊天记录导入 |
| `plugin_root` | 本插件相对桌宠根的路径 |
| `wechat_tool_root` | `wechat-chat-export` 的本机目录 |
| `qq_tool_root` | `qq-chat-exporter` 的本机目录 |
| `qq_exports_dir` | QQ 导出目录；留空时若存在桌面 `qq聊天记录` 会自动使用 |
| `owner_aliases` | 主人昵称别名，例如 `["胃疾癣", "我"]`；默认空 |

`owner_aliases` 为空时，只认导出数据里的 `is_self`（微信）或 `sendType=1`（QQ）。如果导出工具没有正确标记，建议先在管理后台补别名，否则主人/对方可能分流错。

---

## 工具

| 工具 | 是否写库 | 作用 |
| --- | --- | --- |
| `im_status` | 否 | 工具根、exports 数量、收件箱摘要 |
| `im_sync_wechat` | `and_import=false` 时不写 | 同步微信 `chat_full_parsed.json` → inbox |
| `im_sync_qq` | `and_import=false` 时不写 | 扫描 QQ 导出目录 → inbox |
| `im_preview` | 否 | 预览一条导出会被切成什么样，默认 8 条 |
| `im_import` | 是（`dry_run` 除外） | 单文件导入，或扫描 inbox |
| `im_digest_wechat` | 是 | 梳理微信主人侧记忆，调用模型并写摘要观察 |

推荐顺序：**先 `status`，再 `preview`，最后 `import`**。

### 关键参数

- `im_sync_wechat({ and_import?: boolean })`
- `im_sync_qq({ and_import?: boolean, exports_dir?: string })`
- `im_preview({ source: "wechat"|"qq", path: string, limit?: number })`
- `im_import({ source?: "wechat"|"qq", path?: string, limit?: number, dry_run?: boolean })`
  - 给 `path` 时是单文件导入，必须同时给 `source`；
  - 不给 `path` 时扫描 inbox；**inbox 扫描不支持 `dry_run`**。
- `im_digest_wechat()`：写操作，会调用云端模型，耗时可能数十秒。

---

## 本机 CLI

在桌宠根目录执行：

```powershell
# 状态
.venv\Scripts\python.exe _dsh_plugins\dsh-chat-memory-ingest\python\cli.py status

# 同步 QQ 导出到收件箱（不写库）
.venv\Scripts\python.exe _dsh_plugins\dsh-chat-memory-ingest\python\cli.py sync-qq

# 预览某个 QQ 文件
.venv\Scripts\python.exe _dsh_plugins\dsh-chat-memory-ingest\python\cli.py preview --source qq --path "D:\path\to\export.txt"

# 单文件 dry-run
.venv\Scripts\python.exe _dsh_plugins\dsh-chat-memory-ingest\python\cli.py import --source wechat --path "D:\path\to\chat_full_parsed.json" --dry-run
```

Linux/macOS 把 `.venv\Scripts\python.exe` 换成 `.venv/bin/python`。

---

## 宿主 API

如果桌宠启用了管理 API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/chat-ingest/status` | 导入状态 |
| `POST` | `/api/chat-ingest/sync-qq` | body：`{ "exports_dir"?: string, "and_import"?: boolean }` |
| `POST` | `/api/chat-ingest/sync-wechat` | body：`{ "and_import"?: boolean }` |

---

## 推荐流程

1. **导出**：用 `wechat-chat-export` / QQChatExporter 导出到本机目录；
2. **同步**：`im_sync_wechat` / `im_sync_qq`，先不要开 `and_import`；
3. **预览**：`im_preview` 抽几条，确认主人/对方分流和切块正常；
4. **小批导入**：`im_import` 指定 `limit`，先导入一小段；
5. **检查记忆**：在桌宠里问一个只有这段聊天才知道的问题，确认召回；
6. **全量导入**：确认无误后再扫描 inbox；
7. **可选 digest**：需要主人侧长期摘要时再跑 `im_digest_wechat`。

> 第一次导入前，建议备份 `cognitive-memory` 的 SQLite 数据目录。

---

## 隐私与安全

聊天记录通常包含大量个人信息。这个插件默认**只在本机处理**，但请注意：

- 导出文件、inbox、`cognitive-memory` 数据库都应视为敏感数据；
- `im_import`、`im_digest_wechat` 是写操作；先 `preview` / `dry_run`，再小批量导入；
- `im_digest_wechat` 会把内容交给云端模型生成摘要，产生 token 费用，也可能把敏感内容带出本机；
- 只导入你有权处理、且得到相关方同意的聊天记录；
- 不要把导出目录、记忆库提交到公开仓库。

---

## 当前限制

- **强依赖 MurasamePet 兼容宿主**；不是独立 CLI 工具。
- 不包含导出器本体，`wechat_tool_root` / `qq_tool_root` 需要自己准备。
- 导出工具格式变化时，`status` / `preview` 可能先报错；先看 `detail`。
- `im_import` 的 inbox 扫描模式不支持 `dry_run`，大目录先单文件预览。
- 没有内置的“撤销导入”；写库前备份。
- `im_digest_wechat` 会调用模型并写摘要，是费用与隐私风险最高的一步。

---

## 验证

```bash
npm test       # 4 项 tool-spec / 宿主契约测试
npm run check  # JS 语法检查
```

测试通过后，再用 `im_status` 确认真实宿主的工具根和 Python 路径。

---

## License

AGPL-3.0-or-later

---

## English

`dsh-chat-memory-ingest` is a DSH plugin that orchestrates **already-exported** WeChat / QQ chats into a MurasamePet-compatible host's cognitive-memory pipeline, splitting owner and peer messages.

- No decryption of private WeChat/QQ databases.
- No bundled exporters; configure paths to local `wechat-chat-export` / `qq-chat-exporter`.
- `owner_aliases` defaults to empty; only `is_self` / `sendType=1` are used unless configured.
- Six tools: `im_status`, `im_sync_wechat`, `im_sync_qq`, `im_preview`, `im_import`, `im_digest_wechat`.
- `im_import` and `im_digest_wechat` write memory; preview and dry-run first, and back up the memory DB.

Install:

```bash
dsh plugin --profile web add github:DSH-Raising-Plan/dsh-chat-memory-ingest
```

See the Chinese sections above for configuration, CLI, API, and the recommended workflow.
