// ================================================================
// フロントマターのパース処理
//
// 【実装方針】
// GROWI はページ閲覧時にフロントマターを DOM から除去するため、
// プラグインは GROWI REST API を叩いてページの生の body を取得し、
// そこからフロントマターを抽出する。
//
// 本番API: GET /api/v3/page?path=<pathname>
//   → レスポンスの pageData.revision.body に生 Markdown が入っている
// ================================================================

export interface ParsedFrontmatter {
  rawYaml: string;
  data: Record<string, unknown>;
}

/**
 * Markdown文字列からYAMLフロントマターを抽出する
 * GROWIは --- で囲まれた先頭ブロックをフロントマターとして扱う
 */
export function extractFrontmatter(markdown: string): ParsedFrontmatter | null {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const rawYaml = match[1].trim();
  const data = parseSimpleYaml(rawYaml);

  return { rawYaml, data };
}

/**
 * 簡易YAMLパーサー
 * 本番では js-yaml などを使うことを推奨するが、
 * モック段階では外部依存を減らすため自前実装
 *
 * 対応フォーマット：
 *   - key: value (文字列・数値・真偽値)
 *   - key: [item1, item2]  (インラインリスト)
 *   - key:                 (マルチラインリスト、- item形式)
 *     - item1
 *     - item2
 */
export function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // コメント・空行スキップ
    if (!line.trim() || line.trim().startsWith('#')) {
      i++;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (rawValue) {
      // インラインリスト: key: [a, b, c]
      if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        const items = rawValue.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
        result[key] = items;
      } else {
        result[key] = parseScalar(rawValue);
      }
      i++;
    } else {
      // 値が空の場合 → 次行以降の - item をリストとして収集
      const list: string[] = [];
      i++;
      while (i < lines.length && lines[i].match(/^\s+-\s+/)) {
        list.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
        i++;
      }
      result[key] = list.length > 0 ? list : null;
    }
  }

  return result;
}

function parseScalar(value: string): unknown {
  // 真偽値
  if (value === 'true') return true;
  if (value === 'false') return false;
  // null
  if (value === 'null' || value === '~') return null;
  // 数値
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  // クォート除去
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

// ================================================================
// GROWI API 経由でページのフロントマターを取得
// ================================================================
export async function fetchPageFrontmatter(pathname: string): Promise<ParsedFrontmatter | null> {
  try {
    // GROWI REST API でページデータ取得
    const res = await fetch(`/api/v3/page?path=${encodeURIComponent(pathname)}`);
    if (!res.ok) return null;

    const json = await res.json();
    const body: string = json?.data?.page?.revision?.body ?? '';
    if (!body) return null;

    return extractFrontmatter(body);
  } catch (e) {
    console.warn('[growi-plugin-frontmatter] API fetch failed:', e);
    return null;
  }
}
