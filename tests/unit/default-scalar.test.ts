import { describe, expect, it } from 'vitest'
import { formatDefaultScalar, parseDefaultScalar } from '../../src/lib/defaultScalar'

describe('DQ default JSON scalar', () => {
  it.each([null, '', '0', 'false', 'null', '001', '  padded  ', 'a"b\nc', 0, -3.25, false, true])(
    'preserves type and value through display/edit for %j',
    (value) => {
      expect(parseDefaultScalar(formatDefaultScalar(value))).toEqual({ valid: true, value })
    },
  )
  it.each(['', '  ', 'null'])('clears the default with %j', (text) => {
    expect(parseDefaultScalar(text)).toEqual({ valid: true, value: null })
  })
  it.each([
    '[]',
    '{}',
    '[1]',
    'text',
    'NaN',
    'Infinity',
    '1e999',
    '9007199254740993',
    '"unfinished',
  ])('rejects invalid or lossy input %j', (text) => {
    expect(parseDefaultScalar(text).valid).toBe(false)
  })
  it('allows exact large values as strings', () => {
    expect(parseDefaultScalar('"9007199254740993"')).toEqual({
      valid: true,
      value: '9007199254740993',
    })
  })
})
