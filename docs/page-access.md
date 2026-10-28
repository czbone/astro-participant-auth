# ページのアクセス制御と画面分岐

このアプリでは、認証サーバーが解決した状態を `Astro.locals.access` に保存し、各 Astro ページで画面や処理を分岐します。

ページの認証判定はミドルウェアが行うため、ページ内でセッション Cookie を直接読みません。参照するのは `Astro.locals.access` だけです。

## 認証状態

```ts
// src/server/auth/access.ts の公開型
export type PageAccess =
  { kind: 'public' } | { kind: 'no-grant'; user: PublicUser } | { kind: 'ok'; user: PublicUser }
```

| 状態       | 意味                                         | `user` |
| ---------- | -------------------------------------------- | ------ |
| `public`   | 公開ページまたは静的ファイル                 | なし   |
| `no-grant` | ログイン済みだが、このアプリの利用権限がない | あり   |
| `ok`       | ログイン済みで、このアプリの利用権限もある   | あり   |

未ログインの通常ページはミドルウェアで認証サーバーへ引き渡されるため、通常のページでは `anonymous` 状態を直接参照しません。

## ページの先頭で状態を確認する

Astro ページのフロントマターで状態を読みます。

```astro
---
const access = Astro.locals.access

if (access.kind === 'public') {
  throw new Error('画面の権限が解決されていません')
}
---
```

公開ページでも認証情報を使わない場合は、この確認を省略できます。その場合、`Astro.locals.access` は常に `public`になります。

## 認証済みユーザーの情報を表示する

ユーザー情報へアクセスできるのは、`ok` と `no-grant` です。

```astro
---
const access = Astro.locals.access

if (access.kind === 'public') {
  throw new Error('画面の権限が解決されていません')
}
---

{access.kind === 'ok' ? (
  <p>ようこそ、{access.user.name}さん</p>
) : (
  <p>このアプリを利用する権限がありません</p>
)}
```

ユーザー情報はテンプレートへ直接出力するため、Astro が HTML エスケープします。生の HTML として連結しません。

## 権限なしを分岐する

```astro
---
const access = Astro.locals.access

if (access.kind === 'public') {
  throw new Error('画面の権限が解決されていません')
}

const allowed = access.kind === 'ok'
if (!allowed) {
  Astro.response.status = 403
}
---

{allowed ? (
  <main>利用できます</main>
) : access.kind === 'no-grant' ? (
  <p>このアプリを利用する権限がありません</p>
) : (
  <p>ログインしてください</p>
)}
```

`Astro.response.status = 403` は通常のページ本文が表示されないためのものではなく、表示する本文と HTTP 応答ステータスを一致させます。未ログインなら通常ミドルウェアが認証サーバーへ引き渡します。

## アプリ内ロールで分岐する

アプリ内ロールは画面や操作の内部分岐にだけ使います。入場可否には使わず、入場判定はミドルウェアが行います。

```astro
---
import { canManageAppRoles, canViewGrants } from '../server/auth/permission'

const access = Astro.locals.access

if (access.kind === 'public') {
  throw new Error('画面の権限が解決されていません')
}

const canView = access.kind === 'ok' && canViewGrants(access.user.role)
const canManage = access.kind === 'ok' && canManageAppRoles(access.user.role)
---

{canView && <a href="/grants">利用許可の例外</a>}
{canManage && <a href="/roles">アプリ内ロール</a>}
```

この判定も画面表示用です。管理操作を実装する場合は、ページだけでなくサーバー処理でも同じ権限を確認します。

## レイアウトでログイン状態を分岐する

共通レイアウトでも同じ状態を参照できます。

```astro
---
const access = Astro.locals.access
const hasSession = access.kind === 'ok' || access.kind === 'no-grant'
---

{hasSession ? (
  <form method="post" action="/logout">
    <button type="submit">ログアウト</button>
  </form>
) : (
  <a href="/">ログイン</a>
)}
```

## 画面表示だけではアクセス制御を完結させない

画面分岐は UI の制御です。重要な処理や更新処理には、サーバー側でもアクセス制御を実装します。

更新リクエストは、ミドルウェアによって次が確認されます。

1. `Origin` が `APP_ORIGIN` と一致すること
2. セッションが有効であること
3. アプリ利用権限があること
4. 更新先の操作が許可リストに含まれること

許可リストに含まれ、ここまで通った更新は、`locals.access` が `ok` の状態で処理へ進みます。許可リストに含まれない更新は、認証確認の後に `404` を返します。

`POST /logout` だけは、パスキーが無い場合とこのアプリの利用権限が無い場合も 403 にせず、ログアウト処理へ進みます。未認証のログアウトは、ほかの更新と同じく 401「ログインが必要です」です。

```ts
export const POST = async ({ locals }: { locals: App.Locals }) => {
  const access = locals.access
  if (access.kind !== 'ok') {
    return new Response('ログインが必要です', { status: 401 })
  }

  // ここから access.user を使った処理を実行する
  return new Response(null, { status: 204 })
}
```

この例は書き方の概念です。実際の API Routes では Astro の `APIRoute` 型など、プロジェクトの型規約に合わせて実装してください。サーバー処理では画面だけでなく、処理を開始する前に `locals.access` を確認します。

## React コンポーネントへの認証情報を渡す

参加アプリ側で Astro の React integration を有効化している場合、認証判定は Astro ページで行い、表示に必要な値だけを React Islandへ渡します。Reactからセッション Cookieや認証サーバーのトークンを直接扱う必要はありません。

### Astro ページ側

`Astro.locals.access` を React の props に変換します。権限判定やロール判定は props を渡す前に行います。

```astro
---
import AccountPanel from '../components/AccountPanel'
import { canManageAppRoles } from '../server/auth/permission'

const access = Astro.locals.access

if (access.kind === 'public') {
  throw new Error('画面の権限が解決されていません')
}

const signedIn = access.kind === 'ok'
const canManage = signedIn && canManageAppRoles(access.user.role)
---

{signedIn ? (
  <AccountPanel client:load userName={access.user.name} canManage={canManage} />
) : (
  <p>このアプリを利用する権限がありません</p>
)}
```

React側へ渡す内容は、画面表示に必要な最小限に限定します。名前、表示用のロール、ロールや権限から計算したフラグなどが対象です。セッション Cookieや生の認証トークンは渡しません。

### React コンポーネント側

```tsx
import { useState } from 'react'

type Props = {
  userName: string
  canManage: boolean
}

export default function AccountPanel({ userName, canManage }: Props) {
  const [message, setMessage] = useState('')

  async function save() {
    const response = await fetch('/api/example', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enabled: true })
    })

    if (!response.ok) {
      setMessage(`保存に失敗しました: ${response.status}`)
      return
    }

    setMessage('保存しました')
  }

  return (
    <section>
      <p>ようこそ、{userName}さん</p>

      {canManage && (
        <button type="button" onClick={save}>
          設定を保存
        </button>
      )}

      <p>{message}</p>
    </section>
  )
}
```

Reactの props はクライアントへ送られ、ブラウザー上で改変できるため、ボタンや画面項目を非表示にする用途にしか使えません。サーバー側のアクセス制御を代替しません。

### Reactから呼ぶ API側でも再確認する

Reactから更新処理を呼ぶ場合は、API Routeでも認証状態と必要な権限を確認します。

```ts
import type { APIRoute } from 'astro'
import { canManageAppRoles } from '../../server/auth/permission'

export const POST: APIRoute = async ({ locals }) => {
  const access = locals.access

  if (access.kind !== 'ok') {
    return new Response('ログインが必要です', { status: 401 })
  }

  if (!canManageAppRoles(access.user.role)) {
    return new Response('権限がありません', { status: 403 })
  }

  // 保存処理
  return new Response(null, { status: 204 })
}
```

Reactの `canManage` propsとAPI側のロール判定は別々の防御です。propsは操作ボタンや項目を隠すためのUI制御、API側の判定は実際の処理を保護するための認可制御です。

## Reactを使う場合の注意

このリポジトリの認証骨格では、Cookieの読み取り、セッション解決、画面への引き渡しはミドルウェアが担当します。Reactコンポーネントから `Astro.locals` を参照したり、セッション Cookieを読み取ったりしません。

また、更新処理はミドルウェアによるセッション確認に加えて、`Origin` と許可リストの確認を受けます。Reactコンポーネント内からではなく、サーバーで処理を実装してください。クライアント側の表示状態だけを信頼せず、API Routeまたは許可されたサーバー処理でも認証・権限を再確認します。
