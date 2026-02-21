/**
 * growi-plugin-frontmatter-viewer
 * client-entry.tsx
 *
 * GROWIのスクリプトプラグイン エントリーポイント。
 * activate() でサイドバーにフロントマターパネルを注入する。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FrontmatterPanel } from './FrontmatterPanel';
import { fetchPageFrontmatter } from './parseFrontmatter';

const PLUGIN_NAME = 'growi-plugin-frontmatter-viewer';
const PANEL_MOUNT_ID = 'grw-frontmatter-panel-root';

let cleanupFn: (() => void) | null = null;

// ================================================================
// サイドバーへのマウント先を探す / なければ作る
//
// GROWIのサイドバー構造（v6〜v7）:
//   .page-wrapper
//     .revision-toc-container  ← TOCが入るコンテナ (右サイドバー相当)
//
// ※ GROWIのDOMは版によって変わりうるため、複数のセレクタでフォールバック
// ================================================================
function findOrCreateMountTarget(): HTMLElement | null {
  // 既存パネルがあれば再利用
  const existing = document.getElementById(PANEL_MOUNT_ID);
  if (existing) return existing;

  // GROWIサイドバーの候補セレクタ（優先順）
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
    // フォールバック：body直下に固定サイドバーを作る
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
  sidebar.prepend(wrapper); // TOCより上に挿入

  return wrapper;
}

// ================================================================
// フロントマターを取得してパネルをマウントする
// ================================================================
async function mountPanel() {
  const target = findOrCreateMountTarget();
  if (!target) return;

  // 現在のページパスで GROWI API を叩く
  const pathname = window.location.pathname;
  const parsed = await fetchPageFrontmatter(pathname);

  const root = createRoot(target);
  root.render(
    <StrictMode>
      <FrontmatterPanel
        rawYaml={parsed?.rawYaml ?? ''}
        data={(parsed?.data ?? {}) as Record<string, never>}
      />
    </StrictMode>
  );

  // cleanup 用にunmount関数を保持
  cleanupFn = () => {
    root.unmount();
    target.remove();
  };
}

// ================================================================
// activate / deactivate
// ================================================================
const activate = (): void => {
  // GROWI コアが利用可能か確認
  const facade = (window as any).growiFacade;
  if (facade == null) {
    console.warn(`[${PLUGIN_NAME}] growiFacade が見つかりません`);
    return;
  }

  mountPanel().catch(e => {
    console.error(`[${PLUGIN_NAME}] mountPanel エラー:`, e);
  });
};

const deactivate = (): void => {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
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
