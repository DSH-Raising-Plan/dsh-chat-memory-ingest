/**
 * contract.test.mjs — tool-spec 形状自检；若本机有 @deepseek-ai/dsh-tools 再跑宿主编译。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { allToolSpecs, TOOLS } from '../src/tool-spec.js';

test('tool-spec: 六个工具名齐全且无禁用约束字段', () => {
  const specs = allToolSpecs();
  assert.equal(specs.length, 6);
  const names = new Set(specs.map((s) => s.name));
  for (const n of Object.values(TOOLS)) {
    assert.ok(names.has(n), `missing ${n}`);
  }
  for (const spec of specs) {
    assert.ok(spec.description && spec.description.length > 20);
    assert.ok(spec.parameters);
    assert.ok(spec.output?.schema);
    assert.equal(typeof spec.output.render, 'function');
    const blob = JSON.stringify(spec.parameters);
    for (const bad of ['minimum', 'maximum', 'pattern', 'minLength', 'maxItems', 'format']) {
      assert.equal(blob.includes(`"${bad}"`), false, `${spec.name} 含宿主不支持的 ${bad}`);
    }
  }
});

test('tool-spec: preview 必填 source+path', () => {
  const preview = allToolSpecs().find((s) => s.name === TOOLS.preview);
  assert.equal(preview.parameters.source.required, true);
  assert.equal(preview.parameters.path.required, true);
});

test('tool-spec: output.render 返回 text 块', () => {
  const status = allToolSpecs().find((s) => s.name === TOOLS.status);
  const blocks = status.output.render({}, { ok: true, text: 'hi', detail: { a: 1 } });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'text');
  assert.match(blocks[0].text, /OK/);
});

const HOST_TOOLS = join(homedir(), '.dsh/profiles/node_modules/@deepseek-ai/dsh-tools/lib/index.js');
const CANDIDATES = [
  process.env.DSH_TOOLS_PATH,
  HOST_TOOLS,
].filter(Boolean);

let host;
let hostPath;
for (const candidate of CANDIDATES) {
  if (!existsSync(candidate)) continue;
  try {
    host = await import(pathToFileURL(candidate).href);
    hostPath = candidate;
    break;
  } catch {
    /* next */
  }
}

test('contract: 宿主 defineTool 接受本插件 schema', async (t) => {
  if (!host?.defineTool) return t.skip('host @deepseek-ai/dsh-tools not found');
  t.diagnostic(`host: ${hostPath}`);
  for (const spec of allToolSpecs()) {
    const tool = host.defineTool({
      ...spec,
      execute: async () => ({ ok: true, text: 'x' }),
    });
    assert.equal(tool.name, spec.name);
    assert.ok(tool.parameters);
  }
});
