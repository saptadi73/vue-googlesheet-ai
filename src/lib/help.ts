import { api, type ApiEnvelope } from '@/lib/api'

export interface HelpCitation {
  article_id: string
  title: string
}

export interface HelpAnswer {
  answer: string
  citations: HelpCitation[]
  suggested_questions: string[]
  insufficient_context: boolean
}

export async function askHelp(question: string, route: string) {
  const response = await api.post<ApiEnvelope<HelpAnswer>>('/help/ask', { question, route })
  return response.data.data
}
