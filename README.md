# astro-participant-auth

参加アプリの認証骨格です。引き渡し、セッション、入場、ログアウト、共有テーブルの参照を持ちます。ログイン、パスキー、ユーザー作成は持ちません。

仕様の正本は、公開するまで参加アプリの `docs/` です。判定は `access.md`、接続は `connections.md`、自動テストは `testing.md` です。

## 公開口

| 入口 | 内容 |
| --- | --- |
| `astro-participant-auth` | `createParticipantFetch`、`PageAccess`、`roleLabel` |
| `astro-participant-auth/integration` | 入場ミドルウェアと4画面の注入。設定は表示名だけ |
| `astro-participant-auth/middleware` | 入場 |
| `astro-participant-auth/layout` | 業務画面のヘッダ |
| `astro-participant-auth/env-check` | 起動前の環境値チェック |

`astro/app` と `astro/hono` はこのパッケージから import しません。参加アプリが引数で渡します。

## セットアップ

```bash
pnpm install
```

`prepare` が共有4テーブルの Prisma Client を `src/generated/prisma` へ生成します。マイグレーションはありません。

統合テストは、このディレクトリの `.env` に `TEST_DATABASE_URL` があるとき実行します。ひな型は `.env.example` です。

## コマンド

| コマンド | 説明 |
| --- | --- |
| `pnpm test` | ユニットテスト |
| `pnpm test:integration` | 起動済みの PostgreSQL と Redis への統合テスト |
| `pnpm test:all` | ユニットテストのあと統合テスト |
| `pnpm db:ensure-test` | `TEST_DATABASE_URL` のデータベースが無ければ作る |
| `pnpm db:generate` | 読み取り用 Prisma Client の生成 |
| `pnpm lint` | ESLint |
