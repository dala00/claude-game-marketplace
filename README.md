# Claude Game Marketplace

alphabrend が作った**ゲームを Claude Code 上でプレイできるようにする**マーケットプレイスです。

各プラグインは 1 本のゲームに対応し、スキル / スラッシュコマンドとして提供されます。Claude Code をゲーム機代わりに、対話しながら遊べます。

## インストール

Claude Code から以下を実行:

```
/plugin marketplace add <このリポジトリの URL>
/plugin install <game-name>@claude-game-marketplace
```

インストール後はスラッシュコマンド（例: `/<game-name>`）でゲームを開始できます。

## ディレクトリ構成

```
claude-game-marketplace/
├── .claude-plugin/
│   └── marketplace.json        # マーケットプレイス定義（plugins は空）
├── README.md
├── LICENSE
└── .gitignore
```

ゲームはまだ未収録。`plugins/<game-name>/` を作って追加していく。

## ゲームを追加する

1. `plugins/<game-name>/` を作成
2. `plugins/<game-name>/.claude-plugin/plugin.json` にメタデータを記述
3. `skills/` `commands/` `agents/` などにゲーム本体を配置
4. ルートの `.claude-plugin/marketplace.json` の `plugins[]` に登録

## ライセンス

MIT
