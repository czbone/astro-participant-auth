import { createContext } from 'astro/middleware'
import { beforeEach, describe, expect, it } from 'vitest'
import { access } from './access'
import { registerMutations } from '../mutations'
import { cookieStore } from '../server/auth/cookie-store'
import { SESSION_COOKIE } from '../server/auth/cookies'
import type { PageAccess } from '../server/auth/access'
import {
  putSession,
  resetStores,
  seedAccessUser,
  sessionTtl,
  sessionValue
} from '../test/integration-db'
import { APP_ID, APP_ORIGIN, SESSION_TTL_SECONDS } from '../test/integration-env'

registerMutations([{ method: 'POST', path: '/example' }])

const user = { id: 'user-1', email: 'a@example.com', name: '参加者', role: 'user' }

function mutationRequest(
  path: string,
  token: string | null,
  origin: string | null = APP_ORIGIN
): Request {
  const headers = new Headers()
  if (origin) headers.set('origin', origin)
  if (token) headers.set('cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}`)
  return new Request(new URL(path, APP_ORIGIN), { method: 'POST', headers })
}

async function expectTtlUnchanged(token: string): Promise<void> {
  const ttl = await sessionTtl(APP_ID, token)
  expect(ttl).toBeGreaterThan(15)
  expect(ttl).toBeLessThanOrEqual(SESSION_TTL_SECONDS)
}

async function runAccess(request: Request): Promise<{
  response: Response
  locals: { access: PageAccess }
  proceeded: boolean
}> {
  const locals = { access: { kind: 'public' as const } }
  let proceeded = false
  const response = await cookieStore.run(async () => {
    const result = await access(
      createContext({ request, locals, defaultLocale: 'ja' }),
      async () => {
        proceeded = true
        return new Response(null, { status: 204 })
      }
    )
    if (!result) throw new Error('middleware did not return a response')
    return result
  })
  return { response, locals, proceeded }
}

describe('access middleware mutations', () => {
  beforeEach(async () => {
    await resetStores()
  })

  it('許可した更新は未認証なら 401 で次へ進まない', async () => {
    const { response, proceeded } = await runAccess(mutationRequest('/example', null))
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('ログインが必要です')
    expect(proceeded).toBe(false)
  })

  it('許可した更新はパスキーが無いと 403 で次へ進まない', async () => {
    const token = 'token-no-passkey'
    await seedAccessUser({ ...user, permission: 'allow', passkey: false })
    await putSession(APP_ID, token, user.id)

    const { response, proceeded } = await runAccess(mutationRequest('/example', token))
    expect(response.status).toBe(403)
    expect(await response.text()).toBe('先にパスキーを登録してください')
    expect(proceeded).toBe(false)
    await expectTtlUnchanged(token)
  })

  it('許可した更新は付与が無いと 403 で次へ進まない', async () => {
    const token = 'token-no-grant'
    await seedAccessUser(user)
    await putSession(APP_ID, token, user.id)

    const { response, proceeded } = await runAccess(mutationRequest('/example', token))
    expect(response.status).toBe(403)
    expect(await response.text()).toBe('このアプリを利用する権限がありません')
    expect(proceeded).toBe(false)
    await expectTtlUnchanged(token)
  })

  it('許可した更新は allow のとき次へ進み、寿命は延ばさない', async () => {
    const token = 'token-allow'
    await seedAccessUser({ ...user, permission: 'allow' })
    await putSession(APP_ID, token, user.id)

    const { response, locals, proceeded } = await runAccess(mutationRequest('/example', token))
    expect(response.status).toBe(204)
    expect(proceeded).toBe(true)
    expect(locals.access).toEqual({ kind: 'ok', user })
    await expectTtlUnchanged(token)
  })

  it('リストに無い更新は allow でも 404 で次へ進まない', async () => {
    const token = 'token-missing'
    await seedAccessUser({ ...user, permission: 'allow' })
    await putSession(APP_ID, token, user.id)

    const { response, proceeded } = await runAccess(mutationRequest('/missing', token))
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('見つかりません')
    expect(proceeded).toBe(false)
    await expectTtlUnchanged(token)
  })

  it('オリジンが違う許可更新は 403 でセッションを残す', async () => {
    const token = 'token-origin'
    await putSession(APP_ID, token, user.id)

    const { response, proceeded } = await runAccess(
      mutationRequest('/example', token, 'http://evil.example')
    )
    expect(response.status).toBe(403)
    expect(await response.text()).toBe('オリジンが不正です')
    expect(proceeded).toBe(false)
    expect(await sessionValue(APP_ID, token)).not.toBeNull()
  })

  it('ログアウトは付与が無くても次へ進む', async () => {
    const token = 'token-logout-grant'
    await seedAccessUser(user)
    await putSession(APP_ID, token, user.id)

    const { response, locals, proceeded } = await runAccess(mutationRequest('/logout', token))
    expect(response.status).toBe(204)
    expect(proceeded).toBe(true)
    expect(locals.access).toEqual({ kind: 'public' })
  })

  it('ログアウトはパスキーが無くても次へ進む', async () => {
    const token = 'token-logout-passkey'
    await seedAccessUser({ ...user, permission: 'allow', passkey: false })
    await putSession(APP_ID, token, user.id)

    const { response, locals, proceeded } = await runAccess(mutationRequest('/logout', token))
    expect(response.status).toBe(204)
    expect(proceeded).toBe(true)
    expect(locals.access).toEqual({ kind: 'public' })
  })

  it('未認証のログアウトは 401 で次へ進まない', async () => {
    const { response, proceeded } = await runAccess(mutationRequest('/logout', null))
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('ログインが必要です')
    expect(proceeded).toBe(false)
  })
})
