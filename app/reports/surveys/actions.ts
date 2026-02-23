'use server'

// ============================================================
// 고객 만족도 조사 - Server Actions
// ============================================================

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { validateDateRange } from '@/lib/date-utils'
import type { SurveyResponse, SurveyFilter, SurveyStats } from '@/types/survey'

const PAGE_SIZE_DEFAULT = 50

/**
 * 전화번호 마스킹 (01012345678 → 010-****-5678)
 */
function maskPhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length < 8) return '***'
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
}

/**
 * DB 행 → SurveyResponse 매핑
 */
function mapRow(row: any): SurveyResponse {
  return {
    id: row.id,
    branch_id: row.branch_id,
    branch_name: row.branches?.name || '',
    external_id: row.external_id,
    submitted_at: row.submitted_at,
    gender: row.gender,
    visit_type: row.visit_type,
    age_group: row.age_group,
    phone: maskPhone(row.phone),
    visit_frequency: row.visit_frequency,
    discovery_channel: row.discovery_channel,
    selection_reason: row.selection_reason,
    skin_concern: row.skin_concern,
    score_consultation: row.score_consultation,
    score_staff: row.score_staff,
    score_wait_time: row.score_wait_time,
    score_procedure: row.score_procedure,
    score_result: row.score_result,
    score_overall: row.score_overall,
    feedback_praise: row.feedback_praise,
    feedback_improvement: row.feedback_improvement,
    feedback_comment: row.feedback_comment,
  }
}

/**
 * 세션 + 권한 검증 후 branchId 반환
 */
async function getAuthorizedBranchId(filter: SurveyFilter) {
  const session = await getSession()
  if (!session) return { error: '로그인이 필요합니다.', branchId: null, session: null }
  if (!['0000', '0001', '0002'].includes(session.role)) {
    return { error: '조회 권한이 없습니다.', branchId: null, session: null }
  }
  const branchId = session.is_headquarters && ['0000', '0001'].includes(session.role)
    ? (filter.branchId || null)
    : session.branch_id
  return { error: null, branchId, session }
}

/**
 * 만족도 조사 응답 목록 조회 (서버 페이지네이션)
 */
export async function getSurveyResponses(
  filter: SurveyFilter,
  page: number = 1,
  pageSize: number = PAGE_SIZE_DEFAULT
): Promise<{ success: boolean; data: SurveyResponse[]; totalCount: number; message?: string }> {
  try {
    const { error: authError, branchId } = await getAuthorizedBranchId(filter)
    if (authError) return { success: false, data: [], totalCount: 0, message: authError }

    const dateError = validateDateRange(filter.startDate, filter.endDate)
    if (dateError) return { success: false, data: [], totalCount: 0, message: dateError }

    const supabase = await createServerClient()

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('survey_responses')
      .select('*, branches(name)', { count: 'exact' })
      .gte('submitted_at', `${filter.startDate}T00:00:00`)
      .lte('submitted_at', `${filter.endDate}T23:59:59`)
      .order('submitted_at', { ascending: false })
      .range(from, to)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('getSurveyResponses error:', error)
      return { success: false, data: [], totalCount: 0, message: error.message }
    }

    return { success: true, data: (data || []).map(mapRow), totalCount: count ?? 0 }
  } catch (error) {
    console.error('getSurveyResponses error:', error)
    return { success: false, data: [], totalCount: 0, message: '알 수 없는 오류가 발생했습니다.' }
  }
}

/**
 * 피드백이 있는 응답만 조회 (최신 500건)
 */
export async function getSurveyFeedback(
  filter: SurveyFilter
): Promise<{ success: boolean; data: SurveyResponse[]; message?: string }> {
  try {
    const { error: authError, branchId } = await getAuthorizedBranchId(filter)
    if (authError) return { success: false, data: [], message: authError }

    const supabase = await createServerClient()

    let query = supabase
      .from('survey_responses')
      .select('*, branches(name)')
      .gte('submitted_at', `${filter.startDate}T00:00:00`)
      .lte('submitted_at', `${filter.endDate}T23:59:59`)
      .or('feedback_praise.not.is.null,feedback_improvement.not.is.null,feedback_comment.not.is.null')
      .order('submitted_at', { ascending: false })
      .limit(500)

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) {
      console.error('getSurveyFeedback error:', error)
      return { success: false, data: [], message: error.message }
    }

    return { success: true, data: (data || []).map(mapRow) }
  } catch (error) {
    console.error('getSurveyFeedback error:', error)
    return { success: false, data: [], message: '피드백 조회 중 오류가 발생했습니다.' }
  }
}

/**
 * 전체 응답 조회 (CSV 내보내기용, 배치 fetch)
 */
export async function getAllSurveyResponses(
  filter: SurveyFilter
): Promise<{ success: boolean; data: SurveyResponse[]; message?: string }> {
  try {
    const { error: authError, branchId } = await getAuthorizedBranchId(filter)
    if (authError) return { success: false, data: [], message: authError }

    const dateError = validateDateRange(filter.startDate, filter.endDate)
    if (dateError) return { success: false, data: [], message: dateError }

    const supabase = await createServerClient()
    const batchSize = 5000
    let allRows: any[] = []
    let batchIndex = 0

    while (true) {
      const from = batchIndex * batchSize
      const to = from + batchSize - 1

      let query = supabase
        .from('survey_responses')
        .select('*, branches(name)')
        .gte('submitted_at', `${filter.startDate}T00:00:00`)
        .lte('submitted_at', `${filter.endDate}T23:59:59`)
        .order('submitted_at', { ascending: false })
        .range(from, to)

      if (branchId) {
        query = query.eq('branch_id', branchId)
      }

      const { data, error } = await query
      if (error) return { success: false, data: [], message: error.message }
      allRows = allRows.concat(data || [])
      if (!data || data.length < batchSize) break
      batchIndex++
    }

    return { success: true, data: allRows.map(mapRow) }
  } catch (error) {
    console.error('getAllSurveyResponses error:', error)
    return { success: false, data: [], message: '데이터 내보내기 중 오류가 발생했습니다.' }
  }
}

/**
 * 만족도 조사 통계 조회 (DB 집계)
 */
export async function getSurveyStats(
  filter: SurveyFilter
): Promise<{ success: boolean; data: SurveyStats | null; message?: string }> {
  try {
    const { error: authError, branchId } = await getAuthorizedBranchId(filter)
    if (authError) return { success: false, data: null, message: authError }

    const supabase = await createServerClient()

    const { data, error } = await supabase.rpc('get_survey_stats', {
      p_start_date: filter.startDate,
      p_end_date: filter.endDate,
      p_branch_id: branchId || null,
    })

    if (error) {
      console.error('getSurveyStats RPC error:', error)
      return { success: false, data: null, message: error.message }
    }

    return { success: true, data: data as SurveyStats }
  } catch (error) {
    console.error('getSurveyStats error:', error)
    return { success: false, data: null, message: '통계 조회 중 오류가 발생했습니다.' }
  }
}
