/**
 * growi-plugin-frontmatter-viewer
 * client-entry.tsx
 *
 * GROWIのスクリプトプラグイン エントリーポイント。
 * activate() でサイドバーにフロントマターパネルを注入する。
 */
import { StrictMode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { FrontmatterPanel } from './FrontmatterPanel';
import { fetchPageFrontmatter } from './parseFrontmatter';

const PLUGIN_NAME = 'growi-plugin-frontmatter-viewer';
const PANEL_MOUNT_ID = 'grw-frontmatter-panel-root';

let root: Root | null = null;
let mountTarget: HTMLElement | null = null;
let cleanupUrlWatch: (() => void) | null = null;

// ================================================================
// サイドバーへのマウント先を探す / なければ作る
// ================================================================
function findOrCreateMountTarget(): HTMLElement | null {
  const existing = document.getElementById(PANEL_MOUNT_ID);
  if (existing) return existing;

  const SIDEBAR_SELECTORS = [
    '.revision-toc-container',
    '[class*="TableOfContents"]',
    '.page-side-contents',
    '#revision-toc',
  ];

  let sidebar: Element | null = null;
  for (const sel of SIDEBAR_SELECTORS) {
    sidebar = document.querySelector(sel);
    if (sidebar) break;
  }

  if (!sidebar) {
    // サイドバーが見つからない場合はパネルを表示しない
    // （fixed 固定パネルは GROWI の UI と競合するため使用しない）
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.id = PANEL_MOUNT_ID;
  wrapper.style.marginBottom = '12px';
  sidebar.prepend(wrapper);

  return wrapper;
}

// ================================================================
// フロントマターを取得してパネルを更新する
// ページ遷移のたびに呼び出す
// ================================================================
async function updatePanel(pathname: string): Promise<void> {
  // pageId URL でない場合（管理画面・検索画面等）はパネルを非表示にして終了
  // pageId = MongoDB ObjectId = 24文字の16進数 (例: /6999390af17c96c558f7d57e)
  if (!PAGE_ID_PATTERN.test(pathname)) {
    if (mountTarget) mountTarget.style.display = 'none';
    return;
  }

  // フロントマターを先に取得する
  // → データがない場合はサイドバー探索・DOM生成を一切行わない
  const revisionId = new URLSearchParams(window.location.search).get('revisionId') ?? undefined;
  const parsed = await fetchPageFrontmatter(pathname, revisionId);

  if (parsed == null || Object.keys(parsed.data).length === 0) {
    // フロントマターなし → 既存パネルがあれば隠して終了
    if (mountTarget) mountTarget.style.display = 'none';
    return;
  }

  // フロントマターあり → ここで初めてサイドバーへの挿入を試みる
  // SPAナビゲーションでGROWIがDOMを再構築した場合、
  // 挿入済み要素が消えていることがある → 再作成する
  if (mountTarget && !document.contains(mountTarget)) {
    mountTarget = null;
    root = null;
  }

  if (!mountTarget) {
    mountTarget = findOrCreateMountTarget();
    if (!mountTarget) return; // サイドバーが見つからなければ表示しない
  }

  if (!root) {
    root = createRoot(mountTarget);
  }

  mountTarget.style.display = '';
  root.render(
    <StrictMode>
      <FrontmatterPanel
        rawYaml={parsed.rawYaml}
        data={parsed.data}
      />
    </StrictMode>
  );
}

// ================================================================
// GROWIのページID URLへの書き換えを待機する
//
// GROWI SPA の挙動:
//   1. リンククリック → history.pushState で /path/a/b に遷移
//   2. ごく短時間後  → history.replaceState で /xxxxxxxxxx (pageId) に書き換え
//
// pageId = MongoDB ObjectId = 24文字の16進数
// pageId URLになってから API を叩く
//
// リビジョン表示時: /xxxxxxxxxx?revisionId=yyyyyy の形式
// この場合は pathname がすでに pageId 形式なので即座に返る
// ================================================================
const PAGE_ID_PATTERN = /^\/[0-9a-f]{24}$/i;

async function waitForPageId(maxWaitMs = 1500): Promise<string> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const pathname = window.location.pathname;
    if (PAGE_ID_PATTERN.test(pathname)) return pathname;
    // 50ms ごとにポーリング
    await new Promise(r => setTimeout(r, 50));
  }

  // タイムアウト：pageIdへの書き換えがなかった場合は現在のpathnameをそのまま返す
  console.warn(`[${PLUGIN_NAME}] pageId URLへの書き換えをタイムアウト (${maxWaitMs}ms)`);
  return window.location.pathname;
}

// ================================================================
// SPA ナビゲーション（URL変化）の監視
// Next.js ベースのGROWIはhistory APIでページを切り替えるため、
// pushState / replaceState をラップして pathname / search の変化を検知する
// ================================================================
function watchUrlChanges(callback: () => void): () => void {
  let currentHref = window.location.pathname + window.location.search;

  const handleChange = () => {
    const next = window.location.pathname + window.location.search;
    if (next !== currentHref) {
      currentHref = next;
      callback();
    }
  };

  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);

  history.pushState = function (...args) {
    origPush(...args);
    handleChange();
  };

  history.replaceState = function (...args) {
    origReplace(...args);
    handleChange();
  };

  window.addEventListener('popstate', handleChange);

  return () => {
    history.pushState = origPush;
    history.replaceState = origReplace;
    window.removeEventListener('popstate', handleChange);
  };
}

// ================================================================
// activate / deactivate
// ================================================================
const activate = (): void => {
  const facade = (window as any).growiFacade;
  if (facade == null) {
    console.warn(`[${PLUGIN_NAME}] growiFacade が見つかりません`);
    return;
  }

  // 初回ロード（初期表示時はすでにpageId URLのはずなので待機不要）
  updatePanel(window.location.pathname).catch(e => {
    console.error(`[${PLUGIN_NAME}] updatePanel エラー:`, e);
  });

  // SPA ページ遷移を監視
  cleanupUrlWatch = watchUrlChanges(() => {
    const pathname = window.location.pathname;

    if (!PAGE_ID_PATTERN.test(pathname)) {
      // 非 pageId URL（管理画面・検索等）→ waitForPageId を挟まず即座にパネルを隠す
      // waitForPageId を使うと 1500ms タイムアウトするまで処理が遅れ、
      // その間に余分な API コールが発生する可能性がある
      updatePanel(pathname).catch(e => {
        console.error(`[${PLUGIN_NAME}] updatePanel エラー:`, e);
      });
      return;
    }

    // pageId URL になっていない一時的なパスの場合、
    // GROWI が replaceState で pageId URL に置き換えるまで待機する
    waitForPageId().then(updatedPathname => {
      updatePanel(updatedPathname).catch(e => {
        console.error(`[${PLUGIN_NAME}] updatePanel エラー:`, e);
      });
    });
  });
};

const deactivate = (): void => {
  cleanupUrlWatch?.();
  cleanupUrlWatch = null;

  root?.unmount();
  root = null;

  mountTarget?.remove();
  mountTarget = null;
};

// ================================================================
// プラグイン登録
// ================================================================
if ((window as any).pluginActivators == null) {
  (window as any).pluginActivators = {};
}
(window as any).pluginActivators[PLUGIN_NAME] = {
  activate,
  deactivate,
};
