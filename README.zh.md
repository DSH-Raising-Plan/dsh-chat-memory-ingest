# dsh-chat-memory-ingest

编排**已导出**的微信 / QQ 聊天记录，按主人/他人分流录入桌宠 `cognitive-memory`。

- **不**解密微信/QQ 私有库  
- **不**整仓拷贝导出工具；配置路径指向本机 `外部github工具包/...`  
- **主人昵称别名默认空**，在 `chat_ingest.owner_aliases` 或管理后台「认知记忆 → 主人昵称别名」编辑；留空则只认导出里的 `is_self` / QQ `sendType=1`

## 依赖路径（桌宠 `config.json`）

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

`qq_exports_dir` 为空时，若存在桌面 `qq聊天记录` 目录会自动使用。  
需要按昵称分流时把 `owner_aliases` 写成如 `["胃疾癣", "我"]`。

## DSH 安装

```bash
dsh plugin --profile <profile> add github:DSH-Raising-Plan/dsh-chat-memory-ingest
```

本地开发也可 link：

```bash
# profile package.json:
#   "dsh-chat-memory-ingest": "link:<绝对路径>/dsh-chat-memory-ingest"
#   dsh.profile.bundles 追加 "dsh-chat-memory-ingest"
pnpm install
```

设置环境变量（可选）：

- `PET_ROOT`：桌宠项目根（默认推断为插件上两级）
- `PET_PYTHON` / 桌宠 `.venv`：跑 `python/cli.py`

## 工具

| 工具 | 作用 |
| --- | --- |
| `im_status` | 工具根 / exports / 收件箱状态 |
| `im_sync_wechat` | 同步 wechat exports → inbox（可 `and_import`） |
| `im_sync_qq` | 同步 QQ TXT/jsonl → inbox（可 `and_import`） |
| `im_preview` | 预览切块（不写库） |
| `im_import` | 单文件或扫描收件箱提交 |
| `im_digest_wechat` | 微信主人侧 digest（调模型，写摘要） |

## 本机 CLI

```bash
# 在桌宠根
.venv\Scripts\python.exe _dsh_plugins\dsh-chat-memory-ingest\python\cli.py status
.venv\Scripts\python.exe _dsh_plugins\dsh-chat-memory-ingest\python\cli.py sync-qq
.venv\Scripts\python.exe _dsh_plugins\dsh-chat-memory-ingest\python\cli.py preview --source qq --path <文件>
```

## 宿主 API

- `GET /api/chat-ingest/status`
- `POST /api/chat-ingest/sync-qq` body: `{ "exports_dir"?: string, "and_import"?: bool }`
- `POST /api/chat-ingest/sync-wechat` body: `{ "and_import"?: bool }`

## 一键流程

1. 用 wechat-chat-export / QQChatExporter 导出到约定目录  
2. `im_sync_wechat` / `im_sync_qq`（或 admin sync）  
3. `im_import` 或开启 `auto_import` 让收件箱调度器扫  
4. 需要时 `im_digest_wechat`
