import { useState } from 'react';
import './FrontmatterPanel.css';

// ================================================================
// 型定義
// ================================================================
interface FrontmatterPanelProps {
  /** YAMLフロントマターの生文字列 (--- ... --- の中身) */
  rawYaml: string;
  /** パースされたオブジェクト */
  data: Record<string, unknown>;
}

// ================================================================
// 値のレンダリング：型に応じて見た目を変える
// ================================================================
function ValueCell({ value }: { value: unknown }) {
  if (typeof value === 'boolean') {
    return (
      <span className={`grw-fm-value--boolean ${value ? '' : 'false'}`}>
        {value ? '✓ true' : '✗ false'}
      </span>
    );
  }

  if (typeof value === 'number') {
    return <span className="grw-fm-value--number">{value}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <ul className="grw-fm-value--array">
        {value.map((item, i) => (
          <li key={i} className="grw-fm-value--array-item">
            {String(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <span className="grw-fm-value--object">
        {JSON.stringify(value, null, 2)}
      </span>
    );
  }

  return <span className="grw-fm-value--string">{String(value)}</span>;
}

// ================================================================
// メインコンポーネント
// ================================================================
export function FrontmatterPanel({ rawYaml, data }: FrontmatterPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  const entries = Object.entries(data);
  const hasData = entries.length > 0;

  return (
    <div className="grw-frontmatter-panel">
      {/* ヘッダー（クリックで折りたたみ） */}
      <div
        className="grw-frontmatter-panel__header"
        onClick={() => setIsOpen(v => !v)}
        title={isOpen ? 'フロントマターを閉じる' : 'フロントマターを開く'}
      >
        <span className="grw-frontmatter-panel__header-icon">📋</span>
        <span className="grw-frontmatter-panel__title">Front Matter</span>
        <span className={`grw-frontmatter-panel__toggle ${isOpen ? 'grw-frontmatter-panel__toggle--open' : ''}`}>
          ▲
        </span>
      </div>

      {/* ボディ */}
      {isOpen && (
        <div className="grw-frontmatter-panel__body">
          {!hasData ? (
            <div className="grw-frontmatter-panel__empty">
              このページにはフロントマターがありません
            </div>
          ) : (
            <>
              {/* テーブルビュー */}
              {!showRaw && (
                <table className="grw-frontmatter-panel__table">
                  <tbody>
                    {entries.map(([key, value]) => (
                      <tr key={key}>
                        <th>{key}</th>
                        <td><ValueCell value={value} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* RAWビュー */}
              {showRaw && (
                <pre className="grw-frontmatter-panel__raw">{rawYaml}</pre>
              )}

              {/* RAW切り替えボタン */}
              <div className="grw-frontmatter-panel__raw-toggle">
                <button
                  className={`grw-frontmatter-panel__raw-btn ${showRaw ? 'grw-frontmatter-panel__raw-btn--active' : ''}`}
                  onClick={() => setShowRaw(v => !v)}
                >
                  {showRaw ? 'テーブル表示' : 'YAML表示'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
