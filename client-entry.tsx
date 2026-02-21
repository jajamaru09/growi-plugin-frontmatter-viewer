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
    console.warn(`[${PLUGIN_NAME}] サイドバーが見つからないため fixed パネルを作成します`);
    const fixed = document.createElement('div');
    fixed.style.cssText = `
      position: fixed; top: 80px; right: 16px;
      width: 240px; z-index: 1000;
    `;
    document.body.appendChild(fixed);
    sidebar = fixed;
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
  // SPAナビゲーションでGROWIがDOMを再構築した場合、
  // 挿入済み要素が消えていることがある → 再作成する
  if (mountTarget && !document.contains(mountTarget)) {
    mountTarget = null;
    root = null;
  }

  if (!mountTarget) {
    mountTarget = findOrCreateMountTarget();
    if (!mountTarget) return;
  }

  if (!root) {
    root = createRoot(mountTarget);
  }

  const parsed = await fetchPageFrontmatter(pathname);
  const hasData = parsed != null && Object.keys(parsed.data).length > 0;

  if (!hasData) {
    // フロントマターなし → コンテナを非表示にして終了
    mountTarget.style.display = 'none';
    return;
  }

  // フロントマターあり → コンテナを表示してレンダリング
  mountTarget.style.display = '';
  root.render(
    <StrictMode>
      <FrontmatterPanel
        rawYaml={parsed!.rawYaml}
        data={parsed!.data as Record<string, never>}
      />
    </StrictMode>
  );
}

// ================================================================
// SPA ナビゲーション（URL変化）の監視
// Next.js ベースのGROWIはhistory APIでページを切り替えるため、
// pushState / replaceState をラップして pathname の変化を検知する
// ================================================================
function watchUrlChanges(callback: (pathname: string) => void): () => void {
  let currentPathname = window.location.pathname;

  const handleChange = () => {
    const next = window.location.pathname;
    if (next !== currentPathname) {
      currentPathname = next;
      callback(next);
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

  // 初回ロード
  updatePanel(window.location.pathname).catch(e => {
    console.error(`[${PLUGIN_NAME}] updatePanel エラー:`, e);
  });

  // SPA ページ遷移を監視
  cleanupUrlWatch = watchUrlChanges(pathname => {
    updatePanel(pathname).catch(e => {
      console.error(`[${PLUGIN_NAME}] updatePanel エラー:`, e);
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
