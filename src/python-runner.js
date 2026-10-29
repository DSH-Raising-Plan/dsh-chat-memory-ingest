/**
 * 解析桌宠根与 Python，spawn 插件 python/cli.py。
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(HERE, '..');
const CLI = join(PLUGIN_ROOT, 'python', 'cli.py');

function candidatePetRoots() {
  const out = [];
  if (process.env.PET_ROOT) out.push(resolve(process.env.PET_ROOT));
  if (process.env.DSH_PET_ROOT) out.push(resolve(process.env.DSH_PET_ROOT));
  // 插件在 _dsh_plugins/<name>/ → 桌宠根为其上两级
  out.push(resolve(PLUGIN_ROOT, '..', '..'));
  return out;
}

export function resolvePetRoot() {
  for (const root of candidatePetRoots()) {
    if (existsSync(join(root, 'Murasame')) && existsSync(join(root, 'config.json'))) {
      return root;
    }
  }
  return candidatePetRoots()[0];
}

export function resolvePython(petRoot) {
  if (process.env.PET_PYTHON) return process.env.PET_PYTHON;
  if (process.env.DSH_PET_PYTHON) return process.env.DSH_PET_PYTHON;
  const win = join(petRoot, '.venv', 'Scripts', 'python.exe');
  if (existsSync(win)) return win;
  const nix = join(petRoot, '.venv', 'bin', 'python');
  if (existsSync(nix)) return nix;
  return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * @param {string[]} args cli 子命令与参数
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ ok: boolean, code: number, stdout: string, stderr: string, parsed: any }>}
 */
export function runCli(args, opts = {}) {
  const petRoot = resolvePetRoot();
  const py = resolvePython(petRoot);
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const fullArgs = [CLI, '--pet-root', petRoot, ...args];

  return new Promise((resolvePromise) => {
    const child = spawn(py, fullArgs, {
      cwd: petRoot,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
        PET_ROOT: petRoot,
      },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    child.stdout?.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr?.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolvePromise({
        ok: false,
        code: -1,
        stdout,
        stderr: String(err),
        parsed: null,
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      let parsed = null;
      const trim = stdout.trim();
      // CLI 约定：最后一段 JSON 对象
      const idx = trim.lastIndexOf('\n{');
      const jsonText = idx >= 0 ? trim.slice(idx + 1) : trim.startsWith('{') ? trim : '';
      if (jsonText) {
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          parsed = null;
        }
      }
      resolvePromise({
        ok: code === 0 && (parsed?.ok !== false),
        code: code ?? -1,
        stdout,
        stderr,
        parsed,
      });
    });
  });
}

export function packResult(run, fallbackText) {
  if (run.parsed && typeof run.parsed === 'object') {
    const p = run.parsed;
    let detail = '';
    try {
      detail = JSON.stringify(p).slice(0, 8000);
    } catch {
      detail = '';
    }
    return {
      ok: Boolean(p.ok),
      text: String(p.text || p.detail || fallbackText || ''),
      detail,
    };
  }
  let detail = '';
  try {
    detail = JSON.stringify({
      code: run.code,
      stdout_tail: (run.stdout || '').slice(-1500),
      stderr_tail: (run.stderr || '').slice(-1000),
    });
  } catch {
    detail = '';
  }
  return {
    ok: false,
    text: fallbackText || run.stderr?.slice(0, 500) || 'CLI 无 JSON 输出',
    detail,
  };
}
