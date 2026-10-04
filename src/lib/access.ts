export function landingPathForRole(role?: string): string {
  if (role === 'PLATFORM_ADMIN') return '/admin'
  if (role === 'SOURCE_OWNER' || role === 'DATA_STEWARD') return '/workspace'
  if (role === 'TECHNICAL_APPROVER') return '/import-reviews'
  return '/dashboard'
}

export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//') || value === '/login') return null
  return value
}
