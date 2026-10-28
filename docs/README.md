# 確定資料

- [ページのアクセス制御と画面分岐](./page-access.md)
- [基本デザインとレイアウト](./layout.md)

## 認証サーバー

ログイン、パスキー、ユーザー作成、共有テーブルの変更は [認証サーバー](https://github.com/czbone/astro-user-webauthn2) が行う。必要な定義は次の確定資料を参照する。

- [確定資料の索引](https://github.com/czbone/astro-user-webauthn2/blob/main/docs/README.md)
- [確定仕様](https://github.com/czbone/astro-user-webauthn2/blob/main/docs/specification.md)（引き渡し `GET /auth/handoff` を含む）
- [セッション管理](https://github.com/czbone/astro-user-webauthn2/blob/main/docs/session-management.md)
- [Redis](https://github.com/czbone/astro-user-webauthn2/blob/main/docs/redis.md)（参加アプリの接続権限を含む）
- [参加アプリとの統合テスト](https://github.com/czbone/astro-user-webauthn2/blob/main/docs/participant-integration.md)
