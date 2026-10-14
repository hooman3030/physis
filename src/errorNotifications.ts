export type ErrorToastMessage = {
  id: number
  message: string
}

let messages: readonly ErrorToastMessage[] = []
let nextId = 0
const listeners = new Set<() => void>()

export function reportApplicationError(message: string): void {
  if (messages.some((current) => current.message === message)) return

  messages = [...messages, { id: nextId++, message }]
  for (const listener of listeners) listener()
}

export function dismissApplicationError(id: number): void {
  const nextMessages = messages.filter((message) => message.id !== id)
  if (nextMessages.length === messages.length) return

  messages = nextMessages
  for (const listener of listeners) listener()
}

export function getApplicationErrors(): readonly ErrorToastMessage[] {
  return messages
}

export function subscribeToApplicationErrors(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
