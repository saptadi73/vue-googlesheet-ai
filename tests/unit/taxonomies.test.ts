import { describe, expect, it } from 'vitest'
import {
  diffVersionTerms,
  validateVersionTerms,
  versionTerms,
  validateTaxonomyConfiguration,
  type VersionTerm,
} from '../../src/lib/taxonomies'
import type { ETL } from '../../src/lib/etl'

const root: VersionTerm = {
  id: 'root',
  code: 'tea',
  label: 'Tea',
  parent_id: null,
  aliases: ['Teh'],
  is_active: true,
}
const child: VersionTerm = {
  id: 'child',
  code: 'green_tea',
  label: 'Green tea',
  parent_id: 'root',
  aliases: [],
  is_active: true,
}
describe('taxonomy version integrity', () => {
  it('rejects cycles, missing or inactive ancestors and changed existing codes', () => {
    expect(() => validateVersionTerms([root, child], [root, child])).not.toThrow()
    expect(() =>
      validateVersionTerms([{ ...root, parent_id: 'child' }, child], [root, child]),
    ).toThrow('siklus')
    expect(() => validateVersionTerms([child], [root, child])).toThrow('parent')
    expect(() =>
      validateVersionTerms([{ ...root, is_active: false }, child], [root, child]),
    ).toThrow('Ancestor')
    expect(() => validateVersionTerms([{ ...root, code: 'changed' }], [root])).toThrow('Kode term')
  })
  it('shows removals and sends only editable term fields while retaining IDs and aliases', () => {
    expect(diffVersionTerms([root, child], [root])).toEqual([
      { id: 'child', operation: 'REMOVE / DEACTIVATE', before: child, after: null },
    ])
    const terms = versionTerms([{ ...root, created_by: 'secret-metadata' } as VersionTerm])
    expect(terms).toEqual([root])
    terms[0]!.aliases.push('new alias')
    expect(root.aliases).toEqual(['Teh'])
  })
})
describe('taxonomy configuration', () => {
  function config() {
    return {
      columns: [
        {
          source_column: 'Kategori',
          target_column: 'category',
          target_type: 'text',
          taxonomy_id: 'taxonomy',
          taxonomy_version: 2,
          taxonomy_required: true,
        },
      ],
      data_quality_rules: [
        { column: 'category', rule: 'in_taxonomy', value: null, action_on_fail: 'REQUIRE_REVIEW' },
      ],
    } as ETL
  }
  it('requires a complete text mapping and disallows WARN or explicit rule domains', () => {
    const value = config()
    expect(() => validateTaxonomyConfiguration(value)).not.toThrow()
    value.columns[0]!.target_type = 'numeric'
    expect(() => validateTaxonomyConfiguration(value)).toThrow('text/varchar')
    value.columns[0]!.target_type = 'text'
    value.data_quality_rules[0]!.action_on_fail = 'WARN'
    expect(() => validateTaxonomyConfiguration(value)).toThrow('WARN')
    value.data_quality_rules[0]!.action_on_fail = 'REJECT_ROW'
    value.data_quality_rules[0]!.value = ['tea']
    expect(() => validateTaxonomyConfiguration(value)).toThrow('value null')
  })
  it('rejects orphan references and removal while a rule still depends on the mapping', () => {
    const value = config()
    value.columns[0]!.taxonomy_id = null
    expect(() => validateTaxonomyConfiguration(value)).toThrow('tidak lengkap')
    value.columns[0]!.taxonomy_version = null
    value.columns[0]!.taxonomy_required = false
    expect(() => validateTaxonomyConfiguration(value)).toThrow('memerlukan mapping')
  })
})
