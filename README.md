# Claude Game Marketplace

alphabrend が作った**ゲームを Claude Code 上でプレイできるようにする**マーケットプレイスです。

各プラグインは 1 本のゲームに対応し、スキル / スラッシュコマンドとして提供されます。Claude Code をゲーム機代わりに、対話しながら遊べます。

## はじめに（初回のみ）

Claude Code でこのマーケットプレイスを登録する:

```
/plugin marketplace add https://github.com/dala00/claude-game-marketplace
```

以降は各ゲームを個別にインストールできます。

---

## 収録ゲーム

### mini-adventure — 短編テキストアドベンチャー

気づくと暗い小部屋に閉じ込められている——テーブルの上には一通の封筒。謎を解き、三つの部屋を抜けた先で、お前は自分自身と向き合うことになる。

**インストール:**
```
/plugin install mini-adventure@claude-game-marketplace
```

**プレイ開始:**
```
/mini-adventure:play
```

### reversi — リバーシ (オセロ)

AI と会話しながら対戦できるリバーシ。先手後手と難易度（easy / normal / hard）を選んで開始。盤面の更新と AI の手選択は同梱の Node.js エンジンが処理するので、合法手判定や石のひっくり返しは常に正確。

**インストール:**
```
/plugin install reversi@claude-game-marketplace
```

**プレイ開始:**
```
/reversi:play
```

---

## ライセンス

MIT
