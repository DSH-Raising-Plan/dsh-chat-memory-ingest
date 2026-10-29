/**
 * tool-spec.js — 工具定义（不含 execute）。
 * 宿主 @deepseek-ai/dsh-tools 的 parameters 是「属性 map」，不是 {type:object,properties}。
 * 不支持 minimum/maximum/pattern 等；required 写在字段上。
 */

export const TOOLS = {
  status: 'im_status',
  syncWechat: 'im_sync_wechat',
  syncQq: 'im_sync_qq',
  preview: 'im_preview',
  import: 'im_import',
  digest: 'im_digest_wechat',
};

function textOut() {
  return {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean', required: true, description: '是否成功' },
        text: { type: 'string', required: true, description: '给人读的摘要' },
        detail: { type: 'string', description: '结构化细节 JSON 字符串（可空）' },
      },
    },
    render(_args, value) {
      const lines = [
        value?.ok ? 'OK' : 'FAIL',
        String(value?.text || ''),
      ];
      if (value?.detail) lines.push(String(value.detail).slice(0, 3500));
      return [{ type: 'text', text: lines.filter(Boolean).join('\n') }];
    },
  };
}

export function statusToolSpec() {
  return {
    name: TOOLS.status,
    description: [
      '查看聊天记忆录入插件状态：微信/QQ 工具根是否就绪、exports 文件数、收件箱摘要。',
      '不读写记忆库。需要桌宠根目录（PET_ROOT）与 Python。',
    ].join('\n'),
    parameters: {
      verbose: {
        type: 'boolean',
        description: '是否在摘要中附带更多路径（可选，默认 false）',
      },
    },
    output: textOut(),
  };
}

export function syncWechatToolSpec() {
  return {
    name: TOOLS.syncWechat,
    description: [
      '把 wechat-chat-export 的 chat_full_parsed.json 同步到记忆收件箱 wechat/，并可触发导入。',
      '不解密微信私有库。and_import=true 时会提交到 cognitive-memory（写操作）。',
    ].join('\n'),
    parameters: {
      and_import: {
        type: 'boolean',
        description: '同步后是否立刻扫描收件箱并提交（默认 false）',
      },
    },
    output: textOut(),
  };
}

export function syncQqToolSpec() {
  return {
    name: TOOLS.syncQq,
    description: [
      '扫描配置的 QQ 导出目录（QCE TXT / .qce_spool_*.jsonl），复制到收件箱 qq/。',
      '不启动 NapCat。and_import=true 时会提交到 cognitive-memory（写操作）。',
      '主人昵称别名取自配置 chat_ingest.owner_aliases（可空）。',
    ].join('\n'),
    parameters: {
      and_import: {
        type: 'boolean',
        description: '同步后是否立刻扫描收件箱并提交（默认 false）',
      },
      exports_dir: {
        type: 'string',
        description: '覆盖配置中的 qq_exports_dir（绝对或相对桌宠根）',
      },
    },
    output: textOut(),
  };
}

export function previewToolSpec() {
  return {
    name: TOOLS.preview,
    description: [
      '预览一条微信/QQ 导出文件将如何切块录入（不写库）。',
      'source 取 wechat 或 qq；path 为本地文件路径。',
    ].join('\n'),
    parameters: {
      source: {
        type: 'string',
        required: true,
        enum: ['wechat', 'qq'],
        description: '平台：wechat | qq',
      },
      path: {
        type: 'string',
        required: true,
        description: '导出文件路径',
      },
      limit: {
        type: 'number',
        description: '预览条数上限，默认 8',
      },
    },
    output: textOut(),
  };
}

export function importToolSpec() {
  return {
    name: TOOLS.import,
    description: [
      '提交聊天记录到 cognitive-memory（写操作）。',
      '提供 path+source 则单文件导入；否则扫描收件箱。limit 默认用配置 submit_limit。',
    ].join('\n'),
    parameters: {
      source: {
        type: 'string',
        enum: ['wechat', 'qq'],
        description: '平台 wechat|qq（单文件时必填）',
      },
      path: {
        type: 'string',
        description: '单文件路径；省略则 scan 收件箱',
      },
      limit: {
        type: 'number',
        description: '提交条数上限',
      },
      dry_run: {
        type: 'boolean',
        description: '只解析不提交',
      },
    },
    output: textOut(),
  };
}

export function digestToolSpec() {
  return {
    name: TOOLS.digest,
    description: [
      '梳理已导入的微信主人侧记忆（写操作：会调用云端模型并写回摘要观察）。',
      '主人别名取自配置（可空）。耗时可能数十秒。',
    ].join('\n'),
    parameters: {
      confirm: {
        type: 'boolean',
        description: '确认执行写操作（建议传 true）',
      },
    },
    output: textOut(),
  };
}

export function allToolSpecs() {
  return [
    statusToolSpec(),
    syncWechatToolSpec(),
    syncQqToolSpec(),
    previewToolSpec(),
    importToolSpec(),
    digestToolSpec(),
  ];
}
