# growi-plugin-frontmatter-viewer

GROWIのサイドバーにフロントマターを表示するスクリプトプラグイン。

## ディレクトリ構成

```
growi-plugin-frontmatter/
├── index.html          # ★ モック開発用（本番には含まれない）
├── client-entry.tsx    # プラグインエントリーポイント
├── src/
│   ├── FrontmatterPanel.tsx   # Reactコンポーネント
│   ├── FrontmatterPanel.css   # スタイル
│   └── parseFrontmatter.ts   # YAMLパース & API呼び出し
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## セットアップ

```bash
# WSL2 のターミナルで実行
cd growi-plugin-frontmatter
npm install

# モック開発サーバー起動（HMR有効）
npm run dev
# → http://localhost:5173 をブラウザで開く
```

## 開発の流れ

1. `npm run dev` でViteサーバーを起動
2. ブラウザで `http://localhost:5173` を開く
3. `src/FrontmatterPanel.tsx` や `FrontmatterPanel.css` を編集 → ブラウザが即時更新
4. 画面下部のデバッグパネルでシナリオを切り替えて動作確認

## 本番ビルド

```bash
npm run build
# → dist/ にビルドファイルが生成される

# ファイル変更を監視して自動ビルド
npm run build:watch
```

## GROWIへの反映方法

1. `npm run build` でビルド
2. Gitea リポジトリへ push
3. GROWI管理画面 → プラグイン → リポジトリURLを指定してインストール

## フロントマターの取得方法について

GROWIはページ閲覧時にフロントマターをDOMから除去するため、
プラグインは `/api/v3/page?path=<パス>` APIを叩いて生のMarkdownを取得し、
YAMLブロックをパースして表示します。
