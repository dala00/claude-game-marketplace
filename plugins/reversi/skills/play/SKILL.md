---
name: play
description: ボードゲーム。AI と会話しながらリバーシ (オセロ) を対戦できる。合法手判定・石のひっくり返し・盤面更新は同梱の Node.js エンジンが処理するため、盤面が崩れる心配はない。
---

# reversi

プレイヤーが Claude (LLM) と会話しながらリバーシを対戦するスキル。**盤面の更新と合法手判定は必ず同梱スクリプトに任せる**。LLM 自身が石を動かしたり、合法かどうかを推測したりはしない。

ただし「**どこに置くか**」の決め方は難易度によって、LLM が考える場合とエンジン (ミニマックス) に任せる場合の両方がある（後述「難易度モード」）。

---

## エンジンの場所と起動方法

`scripts/reversi.js` がエンジン。SKILL.md と同じ階層の `scripts/` に置かれている。実行時には絶対パス (`<plugin-root>/scripts/reversi.js`) を組み立てて Bash で `node` 起動する。

サブコマンド:

| コマンド | 入力 (stdin) | 用途 |
|---|---|---|
| `node reversi.js init [--human X\|O] [--difficulty easy\|normal\|hard] [--svg <path>]` | なし | 初期 state を作る (`--svg` 指定で SVG ファイルも書き出す) |
| `echo '<state>' \| node reversi.js move <pos> [--no-svg]` | 直前の state | 着手 (人間 or LLM が選んだ手) を適用 |
| `echo '<state>' \| node reversi.js ai [--no-svg]` | 直前の state | エンジン (ミニマックス) で着手を決め適用 |
| `echo '<state>' \| node reversi.js analyze` | 任意の state | 現手番の各候補手にメタ情報を付けて返す（着手も SVG 出力もしない） |
| `echo '<state>' \| node reversi.js random-pick [--top N]` | 任意の state | 上位 N 候補 (opponentMoves 昇順) からランダムに 1 手選んで `{pos: ...}` を返す（着手はしない） |
| `echo '<state>' \| node reversi.js show [--no-svg]` | 任意の state | 同じ盤面を再描画 |

state の `svgPath` がセットされていれば、`init`/`move`/`ai`/`show` を呼ぶたび**同じファイル**が自動で上書きされる (LLM 側で SVG を書く必要なし)。

**`--no-svg` は「この呼び出しでは SVG ファイルを書かない」フラグ。** シミュレーション / 仮想的に手を進める用途では必ずこれを付ける。確定着手（実際に盤を進める一回）には付けない — それが SVG 更新のトリガーになる。

state JSON の主要フィールド:
- `board`: 8 行 × 8 文字 (`.` 空, `X` 黒, `O` 白)
- `turn`: 次の手番 (`X` か `O`)
- `human`: 人間の側
- `difficulty`: `easy` / `normal` / `hard`
- `depth`: エンジンの探索深さ (1 / 3 / 5)
- `svgPath`: SVG 出力先のパス (null なら出力しない)
- `emptyCount`: 残り空マス数
- `aiShouldUseEngine`: **AI 手番のとき、エンジンに着手を任せるべきか** (難易度と emptyCount から計算済み)
- `legalMoves`: 現手番の合法手一覧
- `lastMove` / `flipped` / `passed` / `gameOver` / `winner`
- `render`: 表示用盤面文字列

`analyze` 出力の `candidates[]` の各要素:
- `pos`: 候補座標
- `flipped`: ひっくり返る石の数
- `opponentMoves`: その手を打った後、**相手に残る合法手の数**（少ないほどモビリティで有利）
- `frontierMine`: その手を打った後の**自分の frontier 石数**（空マスに接する自石）。少ないほど安全
- `frontierOpp`: その手を打った後の**相手の frontier 石数**。多いほど相手は崩れやすい
- `opponentBestFlip`: その手を打った後、相手が次手で取れる**最大 flip 数**（worst-case 被害）
- `opponentCanCorner`: その手を打った後、相手が**次手で隅を取れる**か。`true` は危険信号
- `corner`: 角 (a1/h1/a8/h8) か
- `xSquare`: 隣接する角が**空**のときの X-square (b2/g2/b7/g7) か
- `cSquare`: 隣接する角が**空**のときの C-square (a2/b1 等) か
- `edge`: 端 (角を除く) か
- `regionEmptyCount`: その候補マスが属する**連結した空マス領域**のサイズ (4 連結)
- `regionParity`: `"odd"` ならその領域は自分が最後に置ける (奇数 = 有利)、`"even"` なら相手が最後に置ける (偶数 = 不利)

不正手や座標フォーマット違反のときはスクリプトが exit 1 で `{"error": "...", "legalMoves": [...]}` を返す。

---

## 起動シーケンス

ユーザーから `/reversi:play`、「リバーシやろう」「オセロやりたい」などの合図があったら:

1. **先手後手・難易度・SVG 出力を尋ねる**:
   - 「どっちで打つ？黒(先手)/白(後手)」
   - 「強さは？ easy / normal / hard」
   - 「盤面を SVG ファイルに出す？（同じファイルに毎ターン上書き、ブラウザで開いておくとリアルタイムで反映される）」
     - デフォルトは **出す**、パスは `./reversi-board.svg` (CWD 直下)
     - 「いらない」「テキストだけでいい」など明示的に拒否されたら出さない
     - ユーザーが独自のパスを指定したらそれを使う
   - デフォルト答え合わせ: 黒・normal・SVG出力あり (`./reversi-board.svg`)
2. `node <plugin-root>/scripts/reversi.js init --human <X|O> --difficulty <easy|normal|hard> [--svg <path>]` を実行
   - SVG を出さない場合は `--svg` を**省略**する
3. 返ってきた state JSON 全体を**会話コンテキスト内に保持**する（毎ターン再投入するため。`svgPath` も含めて丸ごと）
4. `render` を整形してプレイヤーに提示。SVG を出す場合は「`<path>` に書き出した。ブラウザで開いておくと毎ターン更新される」と一言伝える
5. 人間が先手なら入力を待つ。AI が先手なら直ちに「AI 手番処理」へ

---

## ターン進行ループ

state JSON の `turn` を見て分岐する:

### 人間の手番 (`turn === human`)

1. プレイヤーの入力から座標を抽出 (`d3` / 「ｄ３」/ 「D-3」→ `d3`)
2. `echo '<state>' | node reversi.js move <pos>` を実行
3. exit 0 なら新 state を保持し、**人間の着手後の盤面 (`render`) を必ず表示**
4. exit 1 なら「そこには置けない」と伝えるだけ（合法手の提案はユーザーが明示的に求めた時のみ）。盤面は変わっていない
5. 続けて AI の手番処理へ

### AI の手番 (`turn !== human`) — 難易度モード参照

詳細は次節「難易度モード」。共通する最後の処理:

1. AI の着手を決定（モードによって LLM 自身 or エンジン）
2. 決まった座標で `echo '<state>' | node reversi.js move <pos>` を実行して盤面に反映
   （エンジンに任せる場合は `ai` サブコマンドが `move` 相当の更新まで一気にやる）
3. 新 state を保持し、**AI の着手後の盤面 (`render`) を必ず表示**
4. `passed` が true なら「自分には手がないのでパス」を伝える
5. 人間の手番に戻る

### 盤面表示の絶対ルール

- 1 ターンで「人間の着手後」と「AI の着手後」の **盤面 2 枚を必ず出す**
- どちらの盤面か分かるよう見出しを付ける（例: `あなたの一手 (d3)` / `AI の一手 (e3)`）
- どちらも state の `render` をそのままコードブロックで出力する

### 終局 (`gameOver === true`)

`winner` を見て勝敗を発表し、`scores` を伝える。「もう一局？」と促す。

---

## 難易度モード

state の `aiShouldUseEngine` フラグが「今この AI 手番でエンジンに任せるべきか」を表す（easy では常に false、normal は emptyCount ≤ 16、hard は emptyCount ≤ 20 で true）。これを最優先で見て分岐する。

```
if (state.aiShouldUseEngine) → エンジンに任せる (echo state | node reversi.js ai)
else                          → LLM が考えて手を決める (echo state | node reversi.js move <pos>)
```

### 序盤の手番 (どの難易度も共通)

`emptyCount > 50` (= 開幕から最初の 5 手程度) の AI 手番は、**`random-pick --top 3` で序盤手を決める**:

```
echo '<state>' | node reversi.js random-pick --top 3
# → {"pos": "c4", "pickedFrom": [...]}
```

返ってきた `pos` をそのまま `move <pos>` で確定する。理由: 序盤は勝敗にほぼ影響しないので**毎回違う流れ**にしたほうがゲームとして面白い。`opponentMoves` 上位 N 候補（同点はランダム化して全部含む）から 1 つ無作為に選ばれる。

### easy

- `aiShouldUseEngine` は終局まで **常に false**
- 序盤 (emptyCount > 50): 上記の `random-pick --top 3` を使う
- それ以降: LLM が `state.legalMoves` から好きな手を 1 つ選ぶ。戦略的に深く考えない（同程度の手なら適当に選んでよい）
- 選んだ手で `move` を呼ぶ。補助のための `analyze` 呼び出しは不要

### normal

- 序盤 (emptyCount > 50): `random-pick --top 3`
- 中盤 (16 < emptyCount ≤ 50, `aiShouldUseEngine === false`): **LLM が軽い heuristics で選ぶ**
  - 必要なら `analyze` を 1 回だけ呼んで候補メタ情報を見る
  - 主な観点 (**機械的な優先順位ではなく、その盤面に応じて重み付けて総合判断する**):
    - `opponentMoves` が小さい手は相手のモビリティを削れて強い
    - **`flipped` は中盤では「少ないほど良い」が強い既定**（下の中盤ルール参照）
    - `frontierMine` が小さい手は自分が崩されにくい
    - `opponentBestFlip` が大きい手は worst-case で多枚返される危険
    - `opponentCanCorner === true` は **原則禁止**（相手に隅を渡す手）
    - `xSquare` / `cSquare` が `true` の手は隣の角を相手に渡しやすい — 基本的には避けたい
    - `corner` / `edge` は安定石につながりやすいが、**取れるからといって自動的に選ばない**。隣の角が空のままなのに端を取ると、その端は安定石にならず後で隅取りの経路にされやすい
    - 終盤に近づいたら `regionParity` も気にする (下の "盤面の偶奇 (parity)" 参照)
- 終盤 (emptyCount ≤ 16, `aiShouldUseEngine === true`): **`ai` サブコマンドに任せる** (深さ 3 で読む)

### hard

- 序盤 (emptyCount > 50): `random-pick --top 3`
- 中盤 (20 < emptyCount ≤ 50, `aiShouldUseEngine === false`): **LLM が深めの思考で選ぶ**
  - まず `analyze` を呼んで候補メタ情報を取得し、複数の観点を総合して判断する
  - 観点 (**機械的な優先順位ではなく、盤面に応じて重み付ける**):
    - **モビリティ**: `opponentMoves` を小さく抑えると相手の選択肢が狭まり、悪手を引き出せる
    - **frontier**: `frontierMine` 小・`frontierOpp` 大が望ましい。中盤で `frontierMine` が増える手は基本悪手
    - **石数 (`flipped`) は中盤では強い既定で少ないほうを取る**: 多く取ると frontier 石が増え、終盤で一気に返される素地になる（下の中盤ルール参照）
    - **worst-case (`opponentBestFlip`)**: 相手が次手で大量返しできる構造になっていないか必ず確認
    - **隅渡し (`opponentCanCorner`)**: `true` の候補は **原則絶対禁止**（相手に隅を即取られる手）
    - **X-square / C-square**: 隣の角を相手に渡す経路を作りやすい。基本避けるが、相手も次手で角を取れない構造なら打ってよい
    - **角・端 (`corner` / `edge`)**: 安定石になりやすい一方、**取れるからといって自動で選ばない**。隣の角がまだ空なのに端だけ取ると、その端は安定石にならず後で隅取りの土台にされやすい (下の "エッジ取得の制約" 参照)
    - **盤面の偶奇 (parity)**: `regionParity` が `"odd"` の領域は自分が最後に置ける (有利)、`"even"` は相手が最後に置ける (不利)。**emptyCount が 30 程度を切ったあたりから意識し、偶数領域には自分から手を出さず、相手に偶数領域へ手を出させる方向で打つ**
    - **盤面位置スコア (WEIGHTS)**: 内蔵の位置重みは目安。構造的判断 (frontier / モビリティ / parity / 角の安全) のほうが優先
  - 必要に応じて読みを深める:
    - 有望候補について `echo '<state>' | node reversi.js move --no-svg <候補>` で**仮想的に**進めた state を取得 (**シミュレーションには必ず `--no-svg` を付ける** — SVG は確定着手時だけ更新するため)
    - その仮想 state にさらに `analyze` をかけ、相手の最良手 (相手目線で同じ観点で評価) を予想
    - 相手の予想手で 1 手進めて、自分の次の打ちやすさを確認 (最大 3 手先まで)。これらも全て `move --no-svg`
    - 思考が終わって最終的な手が決まったら、元の state（思考前の state）に対して `move <chosen>` (フラグなし) を呼んで確定 → このとき初めて SVG が更新される
- 終盤 (emptyCount ≤ 20, `aiShouldUseEngine === true`): **`ai` サブコマンドに任せる** (深さ 5 で読む)

### 中盤ルール: 「石を取りすぎない」が最優先

**`emptyCount > 35` の間 (= 序中盤) は `flipped` を小さく抑えることを強い既定にする。**

- 候補に `flipped <= 2` の手があれば、原則そこから選ぶ
- `flipped >= 3` の手を中盤で選ぶのは、以下のような**明確な構造的理由**があるときだけ:
  - その手で隅 (`corner === true`) を確保する
  - その手で相手の隅取りの脅威 (`opponentCanCorner === true` の状況) を消す
  - その手で `opponentBestFlip` を劇的に下げる（相手の脅威手を奪う）
- 上記いずれでもなく、ただ「opponentMoves が良い」「edge が取れる」だけで多 flip を選ぶのは **罠**

**理由**: リバーシでは中盤で石が多い側は **frontier (空マスに接する自石) が広い側** であり、終盤で一気に返される素地になる。実際、O 25 - X 13 と一見圧勝に見える局面から、人間が隅を順に取ることで O が大量に flip されて逆転されるパターンが起きる。**中盤で自分の石数が相手より明らかに多いのは赤信号**。

### エッジ取得の制約

`edge === true` の手は「安定石になりやすい」と直感的に思えるが、**隅と連結しないエッジ石は安定しない**。

- その端を取った後、**同じ辺の角 (a1/a8/h1/h8) がまだ空** なら、その端は将来「相手が隅を取る経路」になる可能性が高い
- 中盤の段階で隅が全て空のまま端だけ多く取ると、最終的に相手が四隅を取ったときに端の自石まで連鎖的に返される
- ルール: **隣の角がまだ空で、かつ自分が次手以降にその角を取れる確証がない場合、その辺の端マスは原則取らない**

### 盤面の偶奇 (parity)

`analyze` の `regionParity` は、その候補マスが属する**連結した空マス領域**の空きマス数の偶奇を表す:

- `regionParity: "odd"` → その領域には残り奇数マス。alternating で打ち合えば**自分が最後に置く側**になる → 有利
- `regionParity: "even"` → その領域には残り偶数マス。alternating で打ち合えば**相手が最後に置く側**になる → 不利

実戦での扱い:
- 終盤に近づくほど効く (emptyCount > 40 ではほぼ無視可、< 30 から意識、< 20 では engine が引き継ぐので考慮不要)
- 「最後に置く側」は周辺を安定化させたり相手に X-square 系の悪手を強いたりできるので、有利
- 候補に odd と even が混在しているなら、他条件が同等なら odd を選ぶ
- 自分から偶数領域に踏み込まない (相手に踏み込ませる) のが基本

---

## 絶対ルール（最重要）

- **盤面 (`board`) を Claude が直接編集しない**。必ず `move` か `ai` を通す
- **合法手の判定を Claude が独自に推測しない**。`state.legalMoves` および `analyze` の出力を信用する
- **`aiShouldUseEngine === true` のときは必ず `ai` を呼ぶ**（LLM が代替判断しない）
- **`aiShouldUseEngine === false` のときは LLM が候補を決め、`move <pos>` で適用する**（`ai` を呼ばない）
- **state JSON を改変しない**。スクリプト出力をそのまま次の入力に流す
- **シミュレーション目的の `move` 呼び出し結果を実 state に反映しない**。`analyze` ベースの読みのために `move` を呼んで仮想 state を作るのは構わないが、実 state を進めるのは最後の確定着手 1 回だけ
- **シミュレーション目的の `move` には必ず `--no-svg` を付ける**。確定着手時のみ SVG が更新されるよう、思考中のチラ見せを防ぐ
- **SVG ファイルを LLM が手書きしない**。エンジンが `svgPath` 宛に自動出力するので、LLM は Write/Edit で SVG を作らない

---

## 出力スタイル

- 盤面は state の `render` をコードブロック（バッククォート 3 つ）で囲んで表示
- 余計なメタ情報（JSON 全文、合法手リスト、スコア計算過程、analyze 出力など）はプレイヤーに見せない
- **デフォルトでは寡黙に対戦する**。各ターンの出力は「盤面 + 着手座標を示す短い見出し」程度
- **以下は求められない限り出さない**:
  - 戦略・定石の解説
  - 合法手の一覧
  - おすすめ手 / ヒント
  - スコアの逐次報告（終局時を除く）
  - 局面評価コメント
- プレイヤーが「ヒント」「どこに置ける？」「解説して」「強い手は？」など**明示的に求めたときだけ**応える。簡潔に
- 終局時は勝敗とスコアを発表（寡黙ルールの例外）
