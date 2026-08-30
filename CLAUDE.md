# Claude Game Marketplace — リポジトリガイド

このリポジトリは Claude Code 向けゲーム配信用のプラグインマーケットプレイス。各プラグイン = 1 本のゲーム。

## 新しいゲームを追加するときの必須手順

アドベンチャー / 推理アドベンチャー（mini-adventure・snow-lantern-mystery 系の「ネタバレ防止シーン分割」型）を作る場合は、オーサリング手順書スキル **`/new-adventure`**（`.claude/skills/new-adventure/`）に設計→生成→登録→到達可能性チェックまでの段取りがまとまっている。推理ものの構成とボリューム基準（五幕・二山構成、中間推理、追及パート、人物の三層化、行数の目安）は同ディレクトリの `structure.md` にあり、**設計前に必ず読む**。それ以外も含む共通の必須手順は以下:

1. `plugins/<game-name>/.claude-plugin/plugin.json` と `plugins/<game-name>/skills/play/SKILL.md` を作成
   - **スキル名は `play` で統一する**（SKILL.md frontmatter `name: play`）。プラグイン提供スキルは `/<plugin>:<skill>` 形式で呼ばれるため、これにより全ゲームが `/<game-name>:play` で揃う
2. `.claude-plugin/marketplace.json` の `plugins[]` に登録
3. **`README.md` の「収録ゲーム」セクションに、コピペで使えるインストール／プレイ開始ブロックを追加する**

README のフォーマットは以下:

````markdown
### <game-name> — <ジャンル / 一行紹介>

<ゲームの導入文（1〜3 行）>

**インストール:**
```
/plugin install <game-name>@claude-game-marketplace
```

**プレイ開始:**
```
/<game-name>:play
```
````

利用者は README をそのままコピペして実行する。SKILL.md の description やフォルダ構成・追加方法など**開発者向け情報は README に書かない**（README は利用者向け）。

## スキルの description

利用者向けに**ゲームの導入文**だけを書く。実装ルール（ファイル分離・トーン強制・覗き見禁止など）は SKILL.md 本文に書く。先頭は「<ジャンル名>。」で始めると一覧での視認性が良い。
