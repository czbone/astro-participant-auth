import { defineMiddleware } from 'astro/middleware'
import { isAllowedMutation } from '../mutations'
import { resolveAccess, slideSession } from '../server/auth/access'
import { clearSessionCookie, readCookie, SESSION_COOKIE } from '../server/auth/cookies'
import { startHandoff } from '../server/auth/handoff'
import { isAllowedOrigin, isUnsafeMethod } from '../server/auth/origin'
import { isStaticAsset } from '../server/auth/return-path'
import { textResponse } from '../server/auth/responses'
import { participantEnv } from '../server/env'

const PUBLIC_PATHS = new Set(['/callback', '/logged-out'])

function isLogout(method: string, pathname: string): boolean {
  return method === 'POST' && pathname === '/logout'
}

export const access = defineMiddleware(async (context, next) => {
  const { request, url } = context
  const method = request.method.toUpperCase()

  if (isUnsafeMethod(method)) {
    if (!isAllowedOrigin(request.headers.get('origin'), participantEnv.appOrigin())) {
      return textResponse(403, 'オリジンが不正です')
    }

    const token = readCookie(request, SESSION_COOKIE)
    const resolved = await resolveAccess(token)
    if (resolved.kind === 'anonymous') {
      if (resolved.clearSession) clearSessionCookie()
      return textResponse(401, 'ログインが必要です')
    }
    if (resolved.kind === 'no-passkey' || resolved.kind === 'no-grant') {
      if (isLogout(method, url.pathname)) return next()
      if (resolved.kind === 'no-passkey') return textResponse(403, '先にパスキーを登録してください')
      return textResponse(403, 'このアプリを利用する権限がありません')
    }
    if (isAllowedMutation(method, url.pathname)) {
      context.locals.access = { kind: 'ok', user: resolved.user }
      return next()
    }
    return textResponse(404, '見つかりません')
  }

  if (method !== 'GET' && method !== 'HEAD') {
    context.locals.access = { kind: 'public' }
    return next()
  }

  if (PUBLIC_PATHS.has(url.pathname) || isStaticAsset(url.pathname)) {
    context.locals.access = { kind: 'public' }
    return next()
  }

  const token = readCookie(request, SESSION_COOKIE)
  const resolved = await resolveAccess(token)
  if (resolved.kind === 'anonymous') {
    if (resolved.clearSession) clearSessionCookie()
    return startHandoff(request)
  }
  if (resolved.kind === 'no-passkey') {
    return Response.redirect(participantEnv.setupPasskeyUrl(), 302)
  }
  if (resolved.kind === 'no-grant') {
    context.locals.access = { kind: 'no-grant', user: resolved.user }
    return next()
  }

  await slideSession(resolved.token, resolved.tokenHash)
  context.locals.access = { kind: 'ok', user: resolved.user }
  return next()
})
