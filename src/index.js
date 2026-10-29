/**
 * dsh-chat-memory-ingest — DSH 插件入口。
 * 编排微信/QQ 已导出产物 → memory-classify → cognitive-memory。
 */
import { packResult, runCli } from './python-runner.js';
import {
  digestToolSpec,
  importToolSpec,
  previewToolSpec,
  statusToolSpec,
  syncQqToolSpec,
  syncWechatToolSpec,
} from './tool-spec.js';

export const name = 'dsh-chat-memory-ingest';
export const inject = ['tools'];

async function loadDefineTool() {
  try {
    const mod = await import('@deepseek-ai/dsh-tools');
    if (mod?.defineTool) return mod.defineTool;
  } catch {
    /* fallback */
  }
  const override = process.env.DSH_TOOLS_PATH;
  if (override) {
    const { pathToFileURL } = await import('node:url');
    const mod = await import(pathToFileURL(override).href);
    if (mod?.defineTool) return mod.defineTool;
  }
  throw new Error('cannot resolve @deepseek-ai/dsh-tools (set DSH_TOOLS_PATH for local dev)');
}

function boolFlag(v, name) {
  if (v === true) return [`--${name}`];
  return [];
}

export async function apply(ctx) {
  const defineTool = await loadDefineTool();
  const disposers = [];

  const status = defineTool({
    ...statusToolSpec(),
    async execute() {
      const run = await runCli(['status'], { timeoutMs: 60_000 });
      return packResult(run, 'im_status');
    },
  });

  const syncWx = defineTool({
    ...syncWechatToolSpec(),
    async execute(args) {
      const a = args || {};
      const run = await runCli(
        ['sync-wechat', ...boolFlag(a.and_import, 'and-import')],
        { timeoutMs: 600_000 },
      );
      return packResult(run, 'im_sync_wechat');
    },
  });

  const syncQq = defineTool({
    ...syncQqToolSpec(),
    async execute(args) {
      const a = args || {};
      const extra = [];
      if (a.exports_dir) extra.push('--exports-dir', String(a.exports_dir));
      const run = await runCli(
        ['sync-qq', ...extra, ...boolFlag(a.and_import, 'and-import')],
        { timeoutMs: 600_000 },
      );
      return packResult(run, 'im_sync_qq');
    },
  });

  const preview = defineTool({
    ...previewToolSpec(),
    async execute(args) {
      const a = args || {};
      const cmd = ['preview', '--source', String(a.source || ''), '--path', String(a.path || '')];
      if (a.limit != null) cmd.push('--limit', String(a.limit));
      const run = await runCli(cmd, { timeoutMs: 120_000 });
      return packResult(run, 'im_preview');
    },
  });

  const imp = defineTool({
    ...importToolSpec(),
    async execute(args) {
      const a = args || {};
      const cmd = ['import'];
      if (a.source) cmd.push('--source', String(a.source));
      if (a.path) cmd.push('--path', String(a.path));
      if (a.limit != null) cmd.push('--limit', String(a.limit));
      if (a.dry_run) cmd.push('--dry-run');
      const run = await runCli(cmd, { timeoutMs: 900_000 });
      return packResult(run, 'im_import');
    },
  });

  const digest = defineTool({
    ...digestToolSpec(),
    async execute() {
      const run = await runCli(['digest'], { timeoutMs: 900_000 });
      return packResult(run, 'im_digest_wechat');
    },
  });

  for (const tool of [status, syncWx, syncQq, preview, imp, digest]) {
    disposers.push(ctx.tools.register(tool));
  }

  return () => {
    for (const d of disposers) {
      try {
        if (typeof d === 'function') d();
      } catch {
        /* ignore */
      }
    }
  };
}
