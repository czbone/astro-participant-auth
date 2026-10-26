import {
  countCredentials,
  findAppDefault,
  findGrantPermission,
  findUserById,
  type PublicUser
} from '../db/read'
import { effectivePermission } from './permission'
import { setSessionCookie } from './cookies'
import { revokeAllSessions } from './revoke'
import { classifySessionValue } from './session-record'
import { hashToken } from './tokens'
import { participantEnv } from '../env'
import { participantRedis } from '../redis/client'
import { RedisKeys } from '../redis/keys'

export type { PublicUser }

export type PageAccess =
  { kind: 'public' } | { kind: 'no-grant'; user: PublicUser } | { kind: 'ok'; user: PublicUser }

export type AccessResult =
  | { kind: 'anonymous'; clearSession: boolean }
  | { kind: 'no-passkey'; user: PublicUser }
  | { kind: 'no-grant'; user: PublicUser }
  | { kind: 'ok'; user: PublicUser; token: string; tokenHash: string }

function toPublicUser(record: {
  id: string
  email: string
  name: string
  role: string | null
}): PublicUser {
  return { id: record.id, email: record.email, name: record.name, role: record.role }
}

async function dropSession(tokenHash: string, userId: string | null): Promise<void> {
  const appId = participantEnv.appId()
  await participantRedis.del(RedisKeys.session(appId, tokenHash))
  if (!userId) return
  await participantRedis.srem(
    RedisKeys.sessionUser(userId),
    RedisKeys.sessionUserMember(appId, tokenHash)
  )
}

export async function resolveAccess(token: string | null): Promise<AccessResult> {
  if (!token) return { kind: 'anonymous', clearSession: false }

  const appId = participantEnv.appId()
  const tokenHash = hashToken(token)
  const raw = await participantRedis.get(RedisKeys.session(appId, tokenHash))
  const classified = classifySessionValue(raw, appId)

  if (classified.action === 'missing') return { kind: 'anonymous', clearSession: true }
  if (classified.action === 'drop') {
    await dropSession(tokenHash, classified.userId)
    return { kind: 'anonymous', clearSession: true }
  }

  const record = await findUserById(classified.userId)
  if (!record) {
    await dropSession(tokenHash, classified.userId)
    return { kind: 'anonymous', clearSession: true }
  }
  if (record.disabledAt) {
    await revokeAllSessions(classified.userId, tokenHash)
    return { kind: 'anonymous', clearSession: true }
  }

  const user = toPublicUser(record)
  const credentials = await countCredentials(record.id)
  if (credentials === 0) return { kind: 'no-passkey', user }

  const grant = await findGrantPermission(record.id, appId)
  const app = await findAppDefault(appId)
  const allowed = effectivePermission({
    appFound: app.found,
    grant,
    defaultPermission: app.found ? app.defaultPermission : null
  })
  if (allowed !== 'allow') return { kind: 'no-grant', user }

  return { kind: 'ok', user, token, tokenHash }
}

export async function slideSession(token: string, tokenHash: string): Promise<void> {
  const maxAge = participantEnv.sessionMaxAgeSeconds()
  await participantRedis.expire(RedisKeys.session(participantEnv.appId(), tokenHash), maxAge)
  setSessionCookie(token, maxAge)
}
