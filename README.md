# dsh-chat-memory-ingest

DeepSeek Harness plugin: orchestrate **already-exported** WeChat / QQ chats into a host cognitive-memory pipeline (owner vs peer split).

- Does **not** decrypt WeChat / QQ private databases  
- Does **not** vendor exporter trees — configure paths to local tools  
- Owner nick aliases default to **empty** (`chat_ingest.owner_aliases`); editable by the host  

中文说明见 [README.zh.md](./README.zh.md).

## Install (DSH)

```bash
dsh plugin --profile <profile> add github:DSH-Raising-Plan/dsh-chat-memory-ingest
```

Or link a local checkout and append `dsh-chat-memory-ingest` to `dsh.profile.bundles`.

Optional env:

- `PET_ROOT` — host project root (default: two levels above this package when nested under `_dsh_plugins/`)
- `PET_PYTHON` — Python used to run `python/cli.py`

## Tools

| Tool | Role |
| --- | --- |
| `im_status` | Tool roots / export counts / inbox summary |
| `im_sync_wechat` | Sync wechat exports → inbox (`and_import` optional) |
| `im_sync_qq` | Sync QQ TXT / `.qce_spool_*.jsonl` → inbox |
| `im_preview` | Preview chunks (no write) |
| `im_import` | Submit one file or scan inbox |
| `im_digest_wechat` | Owner-side WeChat digest (LLM write) |

## Host contract

The Node tools spawn `python/cli.py`, which imports the host modules (`Murasame.*`, `memory_classify_assist`). A MurasamePet-compatible host is expected; see README.zh.md for `config.json` / admin API notes.

## License

AGPL-3.0-or-later
