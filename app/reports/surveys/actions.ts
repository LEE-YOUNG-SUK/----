'use server'

// ============================================================
// 고객 만족도 조사 - Server Actions
// ============================================================

import { createServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { validateDateRange } from '@/lib/date-utils'
import type { SurveyResponse, SurveyFilter, SurveyStats, MonthlyTrend } from '@/types/survey'

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
 * 만족도 조사 응답 목록 조회
 */
export async function getSurveyResponses(
  filter: SurveyFilter
): Promise<{ success: boolean; data: SurveyResponse[]; message?: string }> {
  try {
    const session = await getSession()
    if (!session) return { success: false, data: [], message: '로그인이 필요합니다.' }

    if (!['0000', '0001', '0002'].includes(session.role)) {
      return { success: false, data: [], message: '조회 권한이 없습니다.' }
    }

    const dateError = validateDateRange(filter.startDate, filter.endDate)
    if (dateError) return { success: false, data: [], message: dateError }

    const branchId = session.role === '0000' ? (filter.branchId || null) : session.branch_id

    const supabase = await createServerClient()

    let query = supabase
      .from('survey_responses')
      .select('*, branches(name)')
      .gte('submitted_at', `${filter.startDate}T00:00:00`)
      .lte('submitted_at', `${filter.endDate}T23:59:59`)
      .order('submitted_at', { ascending: false })

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query

    if (error) {
      console.error('getSurveyResponses error:', error)
      return { success: false, data: [], message: error.message }
    }

    const mapped: SurveyResponse[] = (data || []).map((row: any) => ({
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
    }))

    return { success: true, data: mapped }
  } catch (error) {
    console.error('getSurveyResponses error:', error)
    return { success: false, data: [], message: '알 수 없는 오류가 발생했습니다.' }
  }
}

/**
 * 만족도 조사 통계 조회
 */
export async function getSurveyStats(
  filter: SurveyFilter
): Promise<{ success: boolean; data: SurveyStats | null; message?: string }> {
  try {
    const session = await getSession()
    if (!session) return { success: false, data: null, message: '로그인이 필요합니다.' }

    if (!['0000', '0001', '0002'].includes(session.role)) {
      return { success: false, data: null, message: '조회 권한이 없습니다.' }
    }

    const branchId = session.role === '0000' ? (filter.branchId || null) : session.branch_id

    const supabase = await createServerClient()

    // 브랜치 조건
    const branchCondition = branchId
      ? `AND branch_id = '${branchId}'`
      : ''

    // 평균 점수 + 총 건수
    const { data: avgData, error: avgError } = await supabase.rpc('exec_sql_readonly', {
      sql_query: `
        SELECT
          COUNT(*)::int AS total_count,
          ROUND(AVG(score_consultation)::numeric, 2) AS avg_consultation,
          ROUND(AVG(score_staff)::numeric, 2) AS avg_staff,
          ROUND(AVG(score_wait_time)::numeric, 2) AS avg_wait_time,
          ROUND(AVG(score_procedure)::numeric, 2) AS avg_procedure,
          ROUND(AVG(score_result)::numeric, 2) AS avg_result,
          ROUND(AVG(score_overall)::numeric, 2) AS avg_overall
        FROM survey_responses
        WHERE submitted_at >= '${filter.startDate}T00:00:00'
          AND submitted_at <= '${filter.endDate}T23:59:59'
          ${branchCondition}
      `
    })

    // RPC가 없으면 직접 쿼리
    let stats: any
    if (avgError) {
      // RPC 없을 경우 JS에서 계산 (fallback)
      const { data: allData } = await supabase
        .from('survey_responses')
        .select('submitted_at, score_consultation, score_staff, score_wait_time, score_procedure, score_result, score_overall, gender, age_group, visit_type, discovery_channel, selection_reason, skin_concern')
        .gte('submitted_at', `${filter.startDate}T00:00:00`)
        .lte('submitted_at', `${filter.endDate}T23:59:59`)
        .match(branchId ? { branch_id: branchId } : {})

      const rows = allData || []
      const count = rows.length

      const avg = (field: string) => {
        const vals = rows.map((r: any) => r[field]).filter((v: any) => v != null)
        return vals.length > 0 ? Math.round((vals.reduce((s: number, v: number) => s + v, 0) / vals.length) * 100) / 100 : 0
      }

      stats = {
        total_count: count,
        avg_consultation: avg('score_consultation'),
        avg_staff: avg('score_staff'),
        avg_wait_time: avg('score_wait_time'),
        avg_procedure: avg('score_procedure'),
        avg_result: avg('score_result'),
        avg_overall: avg('score_overall'),
        gender_distribution: computeDistribution(rows, 'gender'),
        age_distribution: computeDistribution(rows, 'age_group'),
        visit_type_distribution: computeDistribution(rows, 'visit_type'),
        discovery_channel_distribution: computeMultiSelectDistribution(rows, 'discovery_channel', CHANNEL_LABELS),
        selection_reason_distribution: computeMultiSelectDistribution(rows, 'selection_reason', REASON_LABELS),
        skin_concern_distribution: computeMultiSelectDistribution(rows, 'skin_concern', CONCERN_LABELS),
        monthly_trend: computeMonthlyTrend(rows),
        score_distribution: computeScoreDistribution(rows),
      }
    } else {
      const row = Array.isArray(avgData) ? avgData[0] : avgData
      // 분포 데이터도 가져오기
      const { data: allData } = await supabase
        .from('survey_responses')
        .select('submitted_at, score_consultation, score_staff, score_wait_time, score_procedure, score_result, score_overall, gender, age_group, visit_type, discovery_channel, selection_reason, skin_concern')
        .gte('submitted_at', `${filter.startDate}T00:00:00`)
        .lte('submitted_at', `${filter.endDate}T23:59:59`)
        .match(branchId ? { branch_id: branchId } : {})

      stats = {
        total_count: row?.total_count || 0,
        avg_consultation: parseFloat(row?.avg_consultation) || 0,
        avg_staff: parseFloat(row?.avg_staff) || 0,
        avg_wait_time: parseFloat(row?.avg_wait_time) || 0,
        avg_procedure: parseFloat(row?.avg_procedure) || 0,
        avg_result: parseFloat(row?.avg_result) || 0,
        avg_overall: parseFloat(row?.avg_overall) || 0,
        gender_distribution: computeDistribution(allData || [], 'gender'),
        age_distribution: computeDistribution(allData || [], 'age_group'),
        visit_type_distribution: computeDistribution(allData || [], 'visit_type'),
        discovery_channel_distribution: computeMultiSelectDistribution(allData || [], 'discovery_channel', CHANNEL_LABELS),
        selection_reason_distribution: computeMultiSelectDistribution(allData || [], 'selection_reason', REASON_LABELS),
        skin_concern_distribution: computeMultiSelectDistribution(allData || [], 'skin_concern', CONCERN_LABELS),
        monthly_trend: computeMonthlyTrend(allData || []),
        score_distribution: computeScoreDistribution(allData || []),
      }
    }

    return { success: true, data: stats }
  } catch (error) {
    console.error('getSurveyStats error:', error)
    return { success: false, data: null, message: '통계 조회 중 오류가 발생했습니다.' }
  }
}

/**
 * 분포 계산 헬퍼
 */
function computeDistribution(
  rows: any[],
  field: string
): { label: string; count: number }[] {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const val = row[field] || '미응답'
    counts[val] = (counts[val] || 0) + 1
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

/** 번호 접두사별 매핑 테이블 */
const CHANNEL_LABELS: Record<string, string> = {
  '1)': '지인소개',
  '2)': '병원 간판/배너 등 현장 광고',
  '3)': '지하철/버스 등 오프라인 광고',
  '4)': '카카오톡/문자 등 메세지 광고',
  '5)': '홈페이지/블로그/포털 등 온라인',
  '6)': 'SNS (인스타/유튜브/강남언니)',
  '7)': '맘카페/지역카페 등 커뮤니티',
  '8)': '기업체 업무 협약/제휴',
}

const REASON_LABELS: Record<string, string> = {
  '1)': '합리적인 가격/프로모션',
  '2)': '시술 기대감과 만족도',
  '3)': '병원 위치가 가까워서',
  '4)': '직원 친절/응대 만족',
  '5)': '브랜드 평판 (지인추천/후기)',
  '6)': '광고가 인상 깊어서',
}

const CONCERN_LABELS: Record<string, string> = {
  '1)': '쁘띠시술 (보톡스/필러)',
  '2)': '리프팅 레이저',
  '3)': '콜라겐재생/스킨부스터',
  '4)': '탄력/리프팅 (라인개선)',
  '5)': '각질/피지관리/스킨케어',
  '6)': '토닝/색소/잡티개선',
  '7)': '여드름/모공/흉터',
  '8)': '레이저 제모',
  '9)': '바디라인/다이어트',
  '10)': '기타 (가다실/주사 등)',
}

/**
 * 복수선택(쉼표 구분) 필드의 번호별 분리 집계
 */
function computeMultiSelectDistribution(
  rows: any[],
  field: string,
  labelMap: Record<string, string>
): { label: string; count: number }[] {
  const counts: Record<string, number> = {}
  const etcCount = { count: 0 }

  for (const row of rows) {
    const val = row[field]
    if (!val || !String(val).trim()) continue

    // 쉼표+공백으로 분리 후 각 항목을 번호 접두사로 매핑
    const items = String(val).split(', ')
    for (const item of items) {
      const trimmed = item.trim()
      if (!trimmed) continue

      let matched = false
      for (const [prefix, label] of Object.entries(labelMap)) {
        if (trimmed.startsWith(prefix)) {
          counts[label] = (counts[label] || 0) + 1
          matched = true
          break
        }
      }
      if (!matched) {
        etcCount.count++
      }
    }
  }

  const result = Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  if (etcCount.count > 0) {
    result.push({ label: '기타(직접입력)', count: etcCount.count })
  }

  return result
}

/**
 * 월별 만족도 추이 계산
 */
function computeMonthlyTrend(rows: any[]): MonthlyTrend[] {
  const groups: Record<string, { sum: number; count: number }> = {}
  for (const row of rows) {
    const d = row.submitted_at
    if (!d) continue
    const month = typeof d === 'string' ? d.slice(0, 7) : new Date(d).toISOString().slice(0, 7)
    if (!groups[month]) groups[month] = { sum: 0, count: 0 }
    if (row.score_overall != null) {
      groups[month].sum += row.score_overall
      groups[month].count++
    }
  }
  return Object.entries(groups)
    .map(([month, { sum, count }]) => ({
      month,
      avg_overall: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
      count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * 점수별 분포 계산 (각 항목의 1~5점 카운트)
 */
function computeScoreDistribution(rows: any[]): Record<string, [number, number, number, number, number]> {
  const fields = ['score_consultation', 'score_staff', 'score_wait_time', 'score_procedure', 'score_result', 'score_overall']
  const result: Record<string, [number, number, number, number, number]> = {}
  for (const field of fields) {
    const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0]
    for (const row of rows) {
      const val = row[field]
      if (val >= 1 && val <= 5) dist[val - 1]++
    }
    result[field] = dist
  }
  return result
}
