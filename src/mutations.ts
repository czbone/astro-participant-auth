export type ParticipantMutation = {
  method: string
  path: string
}

const MUTATIONS_KEY = '__astroParticipantAuthMutations'

type MutationState = {
  [MUTATIONS_KEY]?: ParticipantMutation[]
}

function state(): ParticipantMutation[] {
  const globals = globalThis as typeof globalThis & MutationState
  if (!globals[MUTATIONS_KEY]) {
    globals[MUTATIONS_KEY] = [{ method: 'POST', path: '/logout' }]
  }
  return globals[MUTATIONS_KEY]
}

export function mutationAllowlist(): readonly ParticipantMutation[] {
  return state()
}

export function registerMutations(extra: readonly ParticipantMutation[]): void {
  const current = state()
  for (const item of extra) {
    const method = item.method.toUpperCase()
    const exists = current.some((entry) => entry.method === method && entry.path === item.path)
    if (!exists) current.push({ method, path: item.path })
  }
}

export function isAllowedMutation(method: string, path: string): boolean {
  const normalized = method.toUpperCase()
  return state().some((entry) => entry.method === normalized && entry.path === path)
}
