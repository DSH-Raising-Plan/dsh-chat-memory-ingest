# -*- coding: utf-8 -*-
"""dsh-chat-memory-ingest CLI：status|sync-wechat|sync-qq|preview|import|digest

输出：stdout 末尾一段 JSON（供 Node python-runner 解析）。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _emit(payload: dict) -> int:
    print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
    return 0 if payload.get("ok") else 1


def _setup_path(pet_root: Path) -> None:
    root = pet_root.resolve()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    mca = root / "packages" / "memory-classify-assist" / "src"
    if mca.is_dir() and str(mca) not in sys.path:
        sys.path.insert(0, str(mca))
    cm = root / "services" / "cognitive-memory" / "src"
    if cm.is_dir() and str(cm) not in sys.path:
        sys.path.insert(0, str(cm))


def _cmd_status(_args: argparse.Namespace) -> dict:
    from Murasame.chat_memory_ingest_bridge import ingest_status

    return ingest_status()


def _cmd_sync_wechat(args: argparse.Namespace) -> dict:
    from Murasame.wechat_export_bridge import sync_and_import, sync_exports_to_inbox

    if args.and_import:
        pack = sync_and_import()
    else:
        pack = {"ok": True, "sync": sync_exports_to_inbox(), "import": None}
    sync = pack.get("sync") or pack
    text = (
        f"wechat sync copied={sync.get('copied_count')} skipped={sync.get('skipped')} "
        f"found={sync.get('found')} and_import={bool(args.and_import)}"
    )
    return {"ok": bool(pack.get("ok", sync.get("ok"))), "text": text, **pack}


def _cmd_sync_qq(args: argparse.Namespace) -> dict:
    from Murasame.chat_memory_ingest_bridge import sync_and_import_qq, sync_qq_exports_to_inbox

    exp = args.exports_dir or None
    if args.and_import:
        pack = sync_and_import_qq(exports_dir=exp)
    else:
        pack = {"ok": True, "sync": sync_qq_exports_to_inbox(exports_dir=exp), "import": None}
    sync = pack.get("sync") or {}
    text = (
        f"qq sync copied={sync.get('copied_count')} skipped={sync.get('skipped')} "
        f"found={sync.get('found')} and_import={bool(args.and_import)}"
    )
    ok = bool(pack.get("ok", sync.get("ok")))
    return {"ok": ok, "text": text, **pack}


def _cmd_preview(args: argparse.Namespace) -> dict:
    from Murasame.memory_classify_bridge import preview_classify_import

    pack = preview_classify_import(
        source=args.source,
        path=args.path,
        limit=int(args.limit or 8),
    )
    rep = pack.get("report") or {}
    preview = rep.get("preview") or pack.get("preview") or []
    text = (
        f"preview source={args.source} parsed={rep.get('parsed')} "
        f"preview_n={len(preview) if isinstance(preview, list) else 0}"
    )
    return {
        "ok": bool(pack.get("ok", True)) and int(rep.get("errors") or 0) == 0,
        "text": text,
        "report": rep,
        "preview_sample": (preview[:3] if isinstance(preview, list) else preview),
    }


def _cmd_import(args: argparse.Namespace) -> dict:
    from Murasame.memory_classify_bridge import submit_classify_import
    from Murasame.memory_classify_inbox import scan_inbox_once
    from Murasame.utils import get_config

    cfg = get_config()
    if args.path:
        if not args.source:
            return {"ok": False, "text": "单文件导入需要 --source", "detail": "missing source"}
        pack = submit_classify_import(
            source=args.source,
            path=args.path,
            cfg=cfg,
            limit=int(args.limit) if args.limit is not None else None,
            dry_run=bool(args.dry_run),
        )
        rep = pack.get("report") or {}
        text = (
            f"import source={args.source} ok={pack.get('ok')} "
            f"parsed={rep.get('parsed')} submitted={rep.get('submitted')} "
            f"errors={rep.get('errors')} dry_run={bool(args.dry_run)}"
        )
        return {"ok": bool(pack.get("ok")), "text": text, **pack}

    if args.dry_run:
        return {"ok": False, "text": "收件箱扫描不支持 dry_run，请指定 --path", "detail": "dry_run"}
    scan = scan_inbox_once(cfg)
    text = f"inbox scan ok={scan.get('ok')} count={scan.get('count')} detail={scan.get('detail') or ''}"
    return {"ok": bool(scan.get("ok")), "text": text, **scan}


def _cmd_digest(_args: argparse.Namespace) -> dict:
    from Murasame.utils import get_config
    from Murasame.wechat_memory_digest import run_wechat_memory_digest

    pack = run_wechat_memory_digest(get_config())
    text = f"digest ok={pack.get('ok')} detail={str(pack.get('detail') or '')[:160]}"
    return {"ok": bool(pack.get("ok")), "text": text, "digest_keys": sorted(k for k in pack.keys() if k != "timeline")[:24], **{k: pack[k] for k in ("ok", "detail", "lifecycle") if k in pack}}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="dsh-chat-memory-ingest")
    ap.add_argument("--pet-root", type=Path, default=None, help="桌宠项目根")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="状态快照")

    p_wx = sub.add_parser("sync-wechat", help="同步微信 exports → inbox")
    p_wx.add_argument("--and-import", action="store_true")

    p_qq = sub.add_parser("sync-qq", help="同步 QQ 导出 → inbox")
    p_qq.add_argument("--and-import", action="store_true")
    p_qq.add_argument("--exports-dir", type=str, default="")

    p_prev = sub.add_parser("preview", help="预览切块")
    p_prev.add_argument("--source", required=True, choices=["wechat", "qq"])
    p_prev.add_argument("--path", required=True)
    p_prev.add_argument("--limit", type=int, default=8)

    p_imp = sub.add_parser("import", help="提交导入")
    p_imp.add_argument("--source", choices=["wechat", "qq"], default=None)
    p_imp.add_argument("--path", default="")
    p_imp.add_argument("--limit", type=int, default=None)
    p_imp.add_argument("--dry-run", action="store_true")

    sub.add_parser("digest", help="微信主人侧 digest")

    args = ap.parse_args(argv)
    pet = args.pet_root
    if pet is None:
        # cli 在 _dsh_plugins/<name>/python/ → 上三级为桌宠根
        pet = Path(__file__).resolve().parents[3]
    _setup_path(Path(pet))

    handlers = {
        "status": _cmd_status,
        "sync-wechat": _cmd_sync_wechat,
        "sync-qq": _cmd_sync_qq,
        "preview": _cmd_preview,
        "import": _cmd_import,
        "digest": _cmd_digest,
    }
    try:
        payload = handlers[args.cmd](args)
    except Exception as exc:  # noqa: BLE001
        return _emit({"ok": False, "text": f"{args.cmd} failed: {exc}", "detail": str(exc)})
    return _emit(payload)


if __name__ == "__main__":
    raise SystemExit(main())
