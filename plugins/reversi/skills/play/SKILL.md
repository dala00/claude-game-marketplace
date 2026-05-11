---
name: play
description: ボードゲーム。AI と会話しながらリバーシ (オセロ) を対戦できる。合法手判定・石のひっくり返し・AI の手選択は同梱の Node.js エンジンが処理するため、盤面が崩れる心配はない。
---

# reversi

プレイヤーが Claude と会話しながらリバーシを対戦するスキル。**盤面の更新は必ず同梱スクリプトに任せる** — Claude 自身が頭の中で石を動かしたり合法手を判定したりは絶対にしない。

---

## エンジンの場所と起動方法

`scripts/reversi.js` がエンジン。SKILL.md と同じ階層の `scripts/` に置かれている。**実行時には絶対パス** (`<plugin-root>/scripts/reversi.js`) を組み立てて Bash で `node` 起動する。

サブコマンド:

| コマンド | 入力 (stdin) | 出力 |
|---|---|---|
| `node reversi.js init [--human X\|O] [--depth N]` | なし | 初期 state JSON |
| `echo '<state>' \| node reversi.js move <pos>` | 直前の state JSON | 人間の手を適用した新 state |
| `echo '<state>' \| node reversi.js ai` | 直前の state JSON | AI の手を適用した新 state |
| `echo '<state>' \| node reversi.js show` | 任意の state JSON | 同じ盤面を再描画した state |

state JSON の主要フィールド:
- `board`: 8 行 × 8 文字の文字列 (`.` 空, `X` 黒, `O` 白)
- `turn`: 次に手番のプレイヤー (`X` か `O`)
- `human`: 人間の側
- `depth`: AI の探索深さ
- `legalMoves`: 現在手番の合法手一覧 (例 `["d3","c4"]`)
- `lastMove` / `flipped`: 直近の着手とひっくり返した石
- `passed`: パスが発生したか
- `gameOver` / `winner`: 終局フラグと勝者
- `render`: 人間に見せる盤面文字列 (これをそのまま出力すれば良い)

不正手や座標フォーマット違反のときはスクリプトが exit 1 で `{"error": "...", "legalMoves": [...]}` を返す。Claude はそれを読んでプレイヤーに分かりやすく説明し直す。

---

## 起動シーケンス

ユーザーから `/reversi:play`、「リバーシやろう」「オセロやりたい」などの合図があったら:

1. **先手後手と難易度を尋ねる**:
   - 「どっちで打つ？黒(先手)/白(後手)」
   - 「強さは？easy(浅い読み) / normal(標準) / hard(やや深い)」
   - デフォルトは「黒・normal」。回答を待たずに進めても良いが、その場合は決めた設定を一言伝える。
2. 難易度を `--depth` に変換: easy=1, normal=3, hard=5
3. `node <plugin-root>/scripts/reversi.js init --human <X|O> --depth <N>` を実行
4. 返ってきた state JSON 全体を**会話コンテキスト内に保持**する（次ターンで再投入するため）
5. `render` を整形してプレイヤーに提示し、軽い導入の一言を添える
6. 人間が先手なら入力を待つ。AI が先手なら直ちに次の「AI 手番処理」に進む

---

## ターン進行ループ

各ターン、現在保持している state JSON の `turn` フィールドを見て分岐する:

### 人間の手番 (`turn === human`)

1. プレイヤーの入力から座標を抽出する（`d3` や「ｄ３」「D-3」なども `d3` に正規化）
2. `echo '<現在 state>' | node reversi.js move <pos>` を実行
3. exit 0 なら新 state を保持し、**人間の着手後の盤面 (`render`) を必ず表示する**
4. exit 1（error 付き）なら、エンジンが返した `legalMoves` を見て「そこには置けない」と伝えるだけにする。合法手リストを並べたり、おすすめ手を提案するのは**プレイヤーが「ヒント」「どこに置ける？」と明示的に求めたときだけ**。盤面は変わっていないので再表示は不要
5. 続けて AI の手番処理へ

### AI の手番 (`turn !== human`)

1. `echo '<現在 state>' | node reversi.js ai` を実行
2. 返ってきた state を保持し、AI の着手座標を一言伝えつつ、**AI の着手後の盤面 (`render`) を必ず表示する**
3. `passed` が true なら「自分には手がないのでパス」を伝える
4. 人間の手番に戻る

### 盤面表示の絶対ルール

- 1 ターンで「人間の着手後」と「AI の着手後」の **盤面 2 枚を必ず出す**。AI の応手だけ表示して人間の着手後の盤面を省略するのは禁止
- どちらの盤面か分かるよう、見出しを付ける（例: `あなたの一手 (d3)` / `AI の一手 (e3)`）
- どちらも state の `render` をそのままコードブロックで出力する。Claude が自分で盤面を再構築しない

### 終局 (`gameOver === true`)

`winner` を見て勝敗を発表し、スコアを伝える。「もう一局？」と促す。

---

## 絶対ルール（最重要 — これを破ると盤面が崩れる）

- **盤面 (`board`) を Claude が直接編集しない。** 必ず `move` か `ai` サブコマンドを通す
- **合法手の判定を Claude が独自に推測しない。** state の `legalMoves` を信用する
- **AI の手を Claude が決めない。** 必ず `ai` サブコマンドが返した手を使う
- **state JSON を改変しない。** スクリプト出力をそのまま次の入力に流す
- **エンジンのファイルを書き換えない。** バグが出たら報告するだけに留める

---

## 出力スタイル

- 盤面は state の `render` をコードブロック（バッククォート 3 つ）で囲んで表示
- 余計なメタ情報（JSON 全文、合法手リスト、スコア計算過程など）はプレイヤーに見せない
- **デフォルトでは寡黙に対戦する**。各ターンの出力は「盤面 + 着手座標を示す短い見出し（例: `AI の一手: e3`）」程度に留める
- **以下は求められない限り出さない**:
  - 戦略・定石の解説（「角は強い」「ここを取られると…」など）
  - 合法手の一覧表示
  - おすすめの着手提案 / ヒント
  - スコアの逐次報告（終局時を除く）
  - 序盤・中盤・終盤などの局面評価コメント
- プレイヤーが「ヒントちょうだい」「どこに置ける？」「解説して」「強い手は？」など**明示的に求めたときだけ**応える。その場合も簡潔に
- 終局時 (`gameOver === true`) は勝敗とスコアを出す。これは寡黙ルールの例外

---

## 例: AI 応手 1 ターンの実行

```bash
node /abs/path/to/plugins/reversi/scripts/reversi.js init --human X --depth 3
# → state1
echo '<state1 全文>' | node /abs/path/to/plugins/reversi/scripts/reversi.js move d3
# → state2 (turn=O)
echo '<state2 全文>' | node /abs/path/to/plugins/reversi/scripts/reversi.js ai
# → state3 (turn=X)
```

state は会話コンテキストに毎ターン保持し、毎回フルで stdin に渡す。
