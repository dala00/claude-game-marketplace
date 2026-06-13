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

### snow-lantern-mystery — 推理アドベンチャー『走馬灯の雪』

記録的な大雪が、山あいの古いランプの宿を閉ざした夜——招かれざる客が、骨董のランプ台で撲殺された。警察は雪が明けるまで来られない。居合わせた古美術修復師・霧島律となり、現場検証と聞き込みで証拠を集め、雪と灯りの残した矛盾から真相を解き明かす。最後に犯人とトリックを指摘するのは、あなた自身だ。

本作のシナリオ・トリックは Claude Fable 5 が執筆しました。

**インストール:**
```
/plugin install snow-lantern-mystery@claude-game-marketplace
```

**プレイ開始:**
```
/snow-lantern-mystery:play
```

### blackout-channel — 推理アドベンチャー『停電チャンネル』

記録的な台風が、川沿いのクリエイターシェアハウスを閉ざした夜——オーナーの人気配信者が、停電明けの朝、スタジオで撲殺体となって見つかる。警察は道路の冠水で昼まで来られない。お試し入居中のゲームデバッガー・透川悠となり、住人たちへの聞き込みと、配信・ログ・電子錠が残した矛盾から真相を解き明かす。最後に犯人とトリックを指摘するのは、あなた自身だ。

本作のシナリオ・トリックは Claude Fable 5 が執筆しました。

**インストール:**
```
/plugin install blackout-channel@claude-game-marketplace
```

**プレイ開始:**
```
/blackout-channel:play
```

### dawn-chalice — 推理アドベンチャー『暁の聖杯』

魔法が使い手の「刻印」を物に残す世界——山あいの古い修道院は、夜ごと魔物除けの大結界に閉ざされる。その夜、王都から聖遺物『暁の聖杯』を検めに来た鑑定官が、結界の内で殺された。使者は三日帰らない。居合わせた遍歴の魔導具修理師リオン・ヴェイルとなり、現場検証と聞き込みで証拠を集め、刻印と灯りの残した矛盾から真相を解き明かす。最後に犯人とトリックを指摘するのは、あなた自身だ。

本作のシナリオ・トリックは Claude Fable 5 が執筆しました。

**インストール:**
```
/plugin install dawn-chalice@claude-game-marketplace
```

**プレイ開始:**
```
/dawn-chalice:play
```

### fukurodo-last-order — 推理アドベンチャー『ふくろう堂のラストオーダー』

駅前商店街の喫茶店「ふくろう堂」の店主が、閉店後の店で階段から落ちて死んだ。警察の結論は事故。納得できない娘に雇われた私立探偵・沢渡圭となり、商店街の人々への聞き込みと現場検証で手がかりを集め、警察が見落とした夜の真相を解き明かす。最後に「いつ・誰が・なぜ」を指摘するのは、あなた自身だ。

本作のシナリオ・トリックは Claude Fable 5 が執筆しました。

**インストール:**
```
/plugin install fukurodo-last-order@claude-game-marketplace
```

**プレイ開始:**
```
/fukurodo-last-order:play
```

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

## ライセンス

MIT
