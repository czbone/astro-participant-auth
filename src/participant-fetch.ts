import { Hono, type MiddlewareHandler } from 'hono'
import { redirectToCanonicalHost } from './server/auth/canonical-host'
import { cookieStore } from './server/auth/cookie-store'
import { handleLogout } from './server/auth/logout'
import { participantEnv, validateRuntimeEnv } from './server/env'
import { registerMutations, type ParticipantMutation } from './mutations'

export type { ParticipantMutation }

type SetCookieSource = {
  getSetCookieFromResponse(response: Response): string[]
}

export type ParticipantFetchOptions = {
  App: SetCookieSource
  middleware: () => MiddlewareHandler
  actions: () => MiddlewareHandler
  pages: () => MiddlewareHandler
  mutations: readonly ParticipantMutation[]
  routes: (app: Hono) => void
}

export type ParticipantFetch = {
  fetch(request: Request): Promise<Response>
}

/**
 * 参加アプリの fetch。仮想モジュールは引数で受け取り、このパッケージからは import しない。
 * 順は middleware、POST /logout、アプリの更新、actions、pages、Set-Cookie。
 */
export function createParticipantFetch(options: ParticipantFetchOptions): ParticipantFetch {
  validateRuntimeEnv()
  registerMutations(options.mutations)

  const app = new Hono()
  app.use(options.middleware())
  app.post('/logout', (c) => handleLogout(c.req.raw))
  options.routes(app)
  app.use(options.actions())
  app.use(options.pages())

  return {
    async fetch(request: Request): Promise<Response> {
      if (!participantEnv.isProduction()) {
        const redirect = redirectToCanonicalHost(request, participantEnv.appOrigin())
        if (redirect) return redirect
      }
      return cookieStore.run(async () => {
        const response = await app.fetch(request)
        const headers = new Headers(response.headers)
        for (const line of cookieStore.current()) {
          headers.append('Set-Cookie', line)
        }
        for (const setCookie of options.App.getSetCookieFromResponse(response)) {
          headers.append('Set-Cookie', setCookie)
        }
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        })
      })
    }
  }
}
