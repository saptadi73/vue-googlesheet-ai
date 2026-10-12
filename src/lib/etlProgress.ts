export type EtlStepState =
  'STALE' | 'CHECKED' | 'CURRENT' | 'PENDING' | 'FAILED' | 'DONE' | 'READY' | 'SUBMITTED'

export interface EtlStepProgressInput {
  labels: string[]
  finalLabel: string
  sectionKeys: string[]
  checkedSections: string[]
  activeStep: number
  dirty: boolean
  validationReady: boolean
  submitted: boolean
  ownerWorkflow: boolean
  active: boolean
  jobStatus?: string
}

export function buildEtlStepProgress(input: EtlStepProgressInput) {
  const sections = input.labels.map((label, index) => {
    const checked = input.checkedSections.includes(input.sectionKeys[index] || '')
    const state: EtlStepState =
      input.dirty && checked
        ? 'STALE'
        : checked
          ? 'CHECKED'
          : input.activeStep === index
            ? 'CURRENT'
            : 'PENDING'
    return {
      label,
      state,
      status:
        state === 'STALE'
          ? 'Perlu diperiksa ulang'
          : state === 'CHECKED'
            ? 'Diperiksa'
            : state === 'CURRENT'
              ? 'Sedang dikerjakan'
              : 'Belum diperiksa',
    }
  })

  let state: EtlStepState = 'PENDING'
  if (input.jobStatus === 'FAILED') state = 'FAILED'
  else if (input.active) state = 'DONE'
  else if (input.dirty && (input.submitted || input.validationReady)) state = 'STALE'
  else if (input.submitted) state = 'SUBMITTED'
  else if (input.validationReady) state = 'READY'
  else if (input.activeStep === 6) state = 'CURRENT'

  const status =
    state === 'FAILED'
      ? 'Job gagal'
      : state === 'DONE'
        ? 'Aktif'
        : state === 'STALE'
          ? 'Perlu validasi ulang'
          : state === 'READY'
            ? 'Siap diproses'
            : state === 'SUBMITTED'
              ? input.ownerWorkflow
                ? 'Validasi tersimpan'
                : 'Menunggu review'
              : state === 'CURRENT'
                ? 'Sedang dikerjakan'
                : 'Belum siap'
  return [...sections, { label: input.finalLabel, state, status }]
}
