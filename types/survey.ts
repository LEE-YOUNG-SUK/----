// ============================================================
// 고객 만족도 조사 타입 정의
// ============================================================

export interface SurveyResponse {
  id: string
  branch_id: string
  branch_name: string
  external_id: string
  submitted_at: string
  gender: string | null
  visit_type: string | null
  age_group: string | null
  phone: string | null
  visit_frequency: string | null
  discovery_channel: string | null
  selection_reason: string | null
  skin_concern: string | null
  score_consultation: number | null
  score_staff: number | null
  score_wait_time: number | null
  score_procedure: number | null
  score_result: number | null
  score_overall: number | null
  feedback_praise: string | null
  feedback_improvement: string | null
  feedback_comment: string | null
}

export interface SurveyFilter {
  startDate: string
  endDate: string
  branchId: string | null
}

export interface MonthlyTrend {
  month: string
  avg_overall: number
  count: number
}

export interface SurveyStats {
  total_count: number
  avg_consultation: number
  avg_staff: number
  avg_wait_time: number
  avg_procedure: number
  avg_result: number
  avg_overall: number
  gender_distribution: { label: string; count: number }[]
  age_distribution: { label: string; count: number }[]
  visit_type_distribution: { label: string; count: number }[]
  discovery_channel_distribution: { label: string; count: number }[]
  selection_reason_distribution: { label: string; count: number }[]
  skin_concern_distribution: { label: string; count: number }[]
  monthly_trend: MonthlyTrend[]
  score_distribution: Record<string, [number, number, number, number, number]>
}

/** 만족도 항목 레이블 매핑 */
export const SCORE_LABELS: Record<string, string> = {
  score_consultation: '상담 직원',
  score_staff: '피부관리사/간호',
  score_wait_time: '대기 시간',
  score_procedure: '시술 과정',
  score_result: '시술 효과',
  score_overall: '전반적 만족도',
}
