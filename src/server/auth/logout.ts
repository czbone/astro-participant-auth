import { resolveAccess } from './access'
import {
  clearHandoffCookie,
  clearSessionCookie,
  readCookie,
  SESSION_COOKIE
} from './cookies'
import { isAllowedOrigin } from './origin'
import { revokeAllSessions } from './revoke'
import { redirectNoStore, textResponse } from './responses'
import { hashToken } from './tokens'
import { participantEnv } from '../env'

export async function handleLogout(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request.headers.get('origin'), participantEnv.appOrigin())) {
    return textResponse(403, 'オリジンが不正です')
  }

  const token = readCookie(request, SESSION_COOKIE)
  const access = await resolveAccess(token)
  if (access.kind === 'anonymous') {
    if (access.clearSession) clearSessionCookie()
    return textResponse(401, 'ログインが必要です')
  }
  if (!token) return textResponse(401, 'ログインが必要です')

  await revokeAllSessions(access.user.id, hashToken(token))
  clearSessionCookie()
  clearHandoffCookie()
  return redirectNoStore('/logged-out', 303)
}
