# Claude Game Marketplace

alphabrend が作った**ゲームを Claude Code 上でプレイできるようにする**マーケットプレイスです。

各プラグインは 1 本のゲームに対応し、スキル / スラッシュコマンドとして提供されます。Claude Code をゲーム機代わりに、対話しながら遊べます。

## はじめに（初回のみ）

Claude Code でこのマーケットプレイスを登録する:

```
/plugin marketplace add https://github.com/dala00/claude-game-marketplace
```

以降は各ゲームを個別にインストールできます。

なお、アドベンチャー / 推理アドベンチャーは `/new-adventure` スキルを使って**自分で作る**こともできます。いいのが作れたら、ぜひ [Contribution](#contribution) から PR を送ってください。

---

## 収録ゲーム

### アドベンチャー / 推理アドベンチャー

テキストアドベンチャー / 推理アドベンチャーは複数収録しています。各タイトルのあらすじ・インストール／プレイ開始ブロックは **[アドベンチャーゲーム一覧（ADVENTURES.md）](ADVENTURES.md)** にまとめています。

- **fukurodo-last-order** — 推理アドベンチャー『ふくろう堂のラストオーダー』
- **dawn-chalice** — 推理アドベンチャー『暁の聖杯』
- **blackout-channel** — 推理アドベンチャー『停電チャンネル』
- **snow-lantern-mystery** — 推理アドベンチャー『走馬灯の雪』
- **mini-adventure** — 短編テキストアドベンチャー

`/new-adventure` スキルを使えば、これらと同じ仕組みで**自分のアドベンチャーを作る**こともできます。

### reversi — リバーシ

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

## Contribution

アドベンチャー / 推理アドベンチャーは `/new-adventure` スキルを使って自分で作れます。ネタバレ防止のシーン分割アーキテクチャに沿って、設計→生成→登録→到達可能性チェックまで案内してくれます。

**いいのが作れたら、気軽に PR を送ってください！** 新作の追加はもちろん、既存ゲームの改善も歓迎です。

---

## ライセンス

MIT
