import { describe, expect, it } from 'vitest'
import { activeNavigationPath } from '../../src/lib/navigation'

describe('active navigation', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/masters/new', '/masters'],
    ['/masters/master-id/storage', '/masters'],
    ['/import-reviews/batch-id', '/import-reviews'],
    ['/configurations/config-id/review', '/workspace'],
    ['/sources/source-id/sheets/sheet-id/master-binding', '/workspace'],
    ['/sources/source-id/sheets/sheet-id/taxonomy-bindings', '/workspace'],
    ['/admin', '/admin'],
    ['/admin/users', '/admin/users'],
    ['/admin/users/new', '/register'],
    ['/register', '/register'],
    ['/account', '/account'],
    ['/access-requests', '/access-requests'],
    ['/masters-other', undefined],
    ['/login', undefined],
  ])('marks the correct parent for %s', (path, expected) => {
    expect(activeNavigationPath(path)).toBe(expected)
  })
})
