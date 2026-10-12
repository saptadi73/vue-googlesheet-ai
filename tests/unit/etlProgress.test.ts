import { describe, expect, it } from 'vitest'
import { buildEtlStepProgress } from '../../src/lib/etlProgress'

const base = {
  labels: ['Identitas', 'Kolom', 'Cleansing', 'Kualitas', 'Pemuatan', 'Analitik'],
  finalLabel: 'Validasi & deploy',
  sectionKeys: ['identity', 'columns', 'cleansing', 'quality', 'load', 'semantic'],
  checkedSections: ['identity', 'columns'],
  activeStep: 2,
  dirty: false,
  validationReady: false,
  submitted: false,
  ownerWorkflow: true,
  active: false,
}

describe('ETL step progress', () => {
  it('shows checklist completion and the current step without implying the rest is done', () => {
    const progress = buildEtlStepProgress(base)
    expect(progress.map(({ state }) => state)).toEqual([
      'CHECKED',
      'CHECKED',
      'CURRENT',
      'PENDING',
      'PENDING',
      'PENDING',
      'PENDING',
    ])
  })

  it('marks checked sections stale when the draft changes', () => {
    const progress = buildEtlStepProgress({ ...base, dirty: true })
    expect(progress[0].state).toBe('STALE')
    expect(progress[0].status).toBe('Perlu diperiksa ulang')
    expect(progress[2].state).toBe('CURRENT')
  })

  it('reports final validation, deployment, and job failure distinctly', () => {
    expect(buildEtlStepProgress({ ...base, validationReady: true })[6].state).toBe('READY')
    expect(buildEtlStepProgress({ ...base, submitted: true })[6].state).toBe('SUBMITTED')
    expect(buildEtlStepProgress({ ...base, submitted: true })[6].status).toBe('Validasi tersimpan')
    expect(buildEtlStepProgress({ ...base, active: true })[6].state).toBe('DONE')
    expect(buildEtlStepProgress({ ...base, jobStatus: 'FAILED' })[6].state).toBe('FAILED')
  })

  it('marks previous validation stale when draft edits follow it', () => {
    expect(buildEtlStepProgress({ ...base, dirty: true, validationReady: true })[6].state).toBe(
      'STALE',
    )
  })
})
