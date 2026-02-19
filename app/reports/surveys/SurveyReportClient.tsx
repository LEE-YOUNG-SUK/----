'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import type { ColDef } from 'ag-grid-community'
import { getSurveyResponses, getSurveyStats } from './actions'
import SurveyDetailModal from './SurveyDetailModal'
import ReportGrid from '@/components/reports/ReportGrid'
import { StatCard } from '@/components/ui/Card'
import { ContentCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FormGrid } from '@/components/shared/FormGrid'
import { UserData } from '@/types'
import type { SurveyResponse, SurveyFilter, SurveyStats, MonthlyTrend } from '@/types/survey'
import { SCORE_LABELS } from '@/types/survey'

interface Props {
  userSession: UserData
  branches: { id: string; name: string }[]
}

type FeedbackTab = 'praise' | 'improvement' | 'comment'

// ─── 점수 셀 스타일 (AG Grid) ────────────────────────────────
function scoreCellStyle(params: any): Record<string, string | number> {
  const v = params.value
  if (v == null) return {} as Record<string, string | number>
  if (v >= 4) return { backgroundColor: '#dcfce7', color: '#166534', fontWeight: 600, textAlign: 'center' }
  if (v >= 3) return { backgroundColor: '#fef9c3', color: '#854d0e', fontWeight: 600, textAlign: 'center' }
  return { backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 600, textAlign: 'center' }
}

// ─── 점수 분포 색상 ──────────────────────────────────────────
const DIST_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']
const DIST_BG = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-600']

// ─── SVG 월별 추이 차트 ─────────────────────────────────────
function TrendChart({ data }: { data: MonthlyTrend[] }) {
  if (data.length < 2) return <p className="text-gray-400 text-sm text-center py-8">2개월 이상 데이터가 필요합니다.</p>

  const W = 520, H = 200
  const pad = { t: 28, r: 24, b: 32, l: 36 }
  const cw = W - pad.l - pad.r
  const ch = H - pad.t - pad.b

  const toX = (i: number) => pad.l + (i / (data.length - 1)) * cw
  const toY = (v: number) => pad.t + ch - ((v - 1) / 4) * ch
  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.avg_overall) }))
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid */}
      {[1, 2, 3, 4, 5].map(v => (
        <g key={v}>
          <line x1={pad.l} y1={toY(v)} x2={W - pad.r} y2={toY(v)} stroke="#f3f4f6" strokeWidth="1" />
          <text x={pad.l - 8} y={toY(v) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{v}</text>
        </g>
      ))}
      {/* Area */}
      <path
        d={`${line} L${points[points.length - 1].x},${pad.t + ch} L${points[0].x},${pad.t + ch} Z`}
        fill="url(#trendGrad)" opacity="0.15"
      />
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Line */}
      <path d={line} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots + values */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={points[i].x} cy={points[i].y} r="4" fill="#fff" stroke="#6366f1" strokeWidth="2" />
          <text x={points[i].x} y={points[i].y - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill="#4f46e5">
            {d.avg_overall.toFixed(1)}
          </text>
          <text x={points[i].x} y={H - 6} textAnchor="middle" fontSize="9" fill="#9ca3af">
            {d.month.slice(5)}월
          </text>
        </g>
      ))}
    </svg>
  )
}

// ─── 점수 분포 막대 (하나의 항목) ────────────────────────────
function ScoreDistBar({ label, dist }: { label: string; dist: [number, number, number, number, number] }) {
  const total = dist.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-[72px] shrink-0 text-right">{label}</span>
      <div className="flex-1 flex h-5 rounded overflow-hidden bg-gray-100">
        {dist.map((count, i) => {
          const pct = (count / total) * 100
          if (pct < 0.5) return null
          return (
            <div
              key={i}
              className={`${DIST_BG[i]} transition-all duration-500 relative group`}
              style={{ width: `${pct}%` }}
              title={`${i + 1}점: ${count}건 (${pct.toFixed(0)}%)`}
            >
              {pct >= 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/90">
                  {pct.toFixed(0)}%
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════

export default function SurveyReportClient({ userSession, branches }: Props) {
  // ─── 날짜 기본값 ────────────────────────────────────────────
  const computeDefaultDates = () => {
    const today = new Date()
    const oneYearAgo = new Date(today)
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    return {
      startDate: fmt(oneYearAgo),
      endDate: fmt(today),
    }
  }

  function fmt(d: Date) {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
  }

  const defaults = computeDefaultDates()

  // ─── State ──────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(defaults.startDate)
  const [endDate, setEndDate] = useState(defaults.endDate)
  const [branchId, setBranchId] = useState<string | null>(userSession.branch_id || null)
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [stats, setStats] = useState<SurveyStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedbackTab, setFeedbackTab] = useState<FeedbackTab>('praise')
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null)

  // ─── 검색 (명시적 파라미터) ─────────────────────────────────
  const doSearch = useCallback(async (sd: string, ed: string, bid: string | null) => {
    setLoading(true)
    setError(null)

    const filter: SurveyFilter = {
      startDate: sd,
      endDate: ed,
      branchId: userSession.role === '0000' ? bid : null,
    }

    try {
      const [responsesRes, statsRes] = await Promise.all([
        getSurveyResponses(filter),
        getSurveyStats(filter),
      ])

      if (responsesRes.success) {
        setResponses(responsesRes.data)
      } else {
        setError(responsesRes.message || '데이터 조회 실패')
      }

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data)
      }
    } catch {
      setError('조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [userSession.role])

  const handleSearch = () => doSearch(startDate, endDate, branchId)

  // ─── 초기 자동 로드 ─────────────────────────────────────────
  useEffect(() => {
    doSearch(defaults.startDate, defaults.endDate, userSession.branch_id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 빠른 날짜 (선택 시 자동 조회) ─────────────────────────
  const handleQuickDateRange = (range: string) => {
    const today = new Date()
    const year = today.getFullYear()
    let sd = '', ed = ''
    switch (range) {
      case 'thisMonth':
        sd = fmt(new Date(year, today.getMonth(), 1))
        ed = fmt(new Date(year, today.getMonth() + 1, 0))
        break
      case 'lastMonth':
        sd = fmt(new Date(year, today.getMonth() - 1, 1))
        ed = fmt(new Date(year, today.getMonth(), 0))
        break
      case 'recent3months': {
        const ago = new Date(today); ago.setMonth(ago.getMonth() - 3)
        sd = fmt(ago); ed = fmt(today)
        break
      }
      case 'thisYear':
        sd = `${year}-01-01`; ed = `${year}-12-31`
        break
      case 'lastYear':
        sd = `${year - 1}-01-01`; ed = `${year - 1}-12-31`
        break
    }
    setStartDate(sd)
    setEndDate(ed)
    doSearch(sd, ed, branchId)
  }

  // ─── CSV 내보내기 ───────────────────────────────────────────
  const handleExport = () => {
    if (responses.length === 0) return
    const headers = ['날짜', '지점', '성별', '연령대', '방문유형', '방문주기', '상담직원', '관리사/간호', '대기시간', '시술과정', '시술효과', '전반적', '정보채널', '선택이유', '시술목적', '칭찬', '개선사항', '기타']
    const rows = responses.map(r => [
      new Date(r.submitted_at).toLocaleDateString('ko-KR'),
      r.branch_name, r.gender, r.age_group, r.visit_type, r.visit_frequency,
      r.score_consultation, r.score_staff, r.score_wait_time, r.score_procedure, r.score_result, r.score_overall,
      r.discovery_channel, r.selection_reason, r.skin_concern,
      r.feedback_praise, r.feedback_improvement, r.feedback_comment,
    ])
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `만족도조사_${startDate}_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── AG Grid 컬럼 ──────────────────────────────────────────
  const columnDefs = useMemo<ColDef<SurveyResponse>[]>(() => [
    {
      headerName: '날짜',
      field: 'submitted_at',
      width: 120,
      pinned: 'left',
      filter: true,
      valueFormatter: (p) => p.value ? new Date(p.value).toLocaleDateString('ko-KR') : '',
    },
    { headerName: '지점', field: 'branch_name', width: 110, filter: true },
    { headerName: '성별', field: 'gender', width: 80, filter: true },
    { headerName: '방문', field: 'visit_type', width: 105, filter: true },
    { headerName: '연령', field: 'age_group', width: 85, filter: true },
    { headerName: '상담', field: 'score_consultation', width: 62, cellStyle: scoreCellStyle },
    { headerName: '직원', field: 'score_staff', width: 62, cellStyle: scoreCellStyle },
    { headerName: '대기', field: 'score_wait_time', width: 62, cellStyle: scoreCellStyle },
    { headerName: '시술', field: 'score_procedure', width: 62, cellStyle: scoreCellStyle },
    { headerName: '효과', field: 'score_result', width: 62, cellStyle: scoreCellStyle },
    { headerName: '전반', field: 'score_overall', width: 62, cellStyle: scoreCellStyle },
    {
      headerName: '칭찬',
      field: 'feedback_praise',
      width: 200,
      cellStyle: { color: '#374151', fontSize: '12px' },
      valueFormatter: (p) => p.value ? (p.value.length > 30 ? p.value.slice(0, 30) + '...' : p.value) : '',
    },
    {
      headerName: '개선',
      field: 'feedback_improvement',
      width: 200,
      cellStyle: { color: '#374151', fontSize: '12px' },
      valueFormatter: (p) => p.value ? (p.value.length > 30 ? p.value.slice(0, 30) + '...' : p.value) : '',
    },
    {
      headerName: '하고싶은말',
      field: 'feedback_comment',
      width: 200,
      cellStyle: { color: '#374151', fontSize: '12px' },
      valueFormatter: (p) => p.value ? (p.value.length > 30 ? p.value.slice(0, 30) + '...' : p.value) : '',
    },
  ], [])

  // ─── 피드백 데이터 (점수/인구통계 포함) ──────────────────────
  const feedbackCounts = useMemo(() => ({
    praise: responses.filter(r => r.feedback_praise?.trim()).length,
    improvement: responses.filter(r => r.feedback_improvement?.trim()).length,
    comment: responses.filter(r => r.feedback_comment?.trim()).length,
  }), [responses])

  const feedbackData = useMemo(() => {
    const fieldMap: Record<FeedbackTab, keyof SurveyResponse> = {
      praise: 'feedback_praise',
      improvement: 'feedback_improvement',
      comment: 'feedback_comment',
    }
    const field = fieldMap[feedbackTab]
    return responses
      .filter((r) => r[field] && String(r[field]).trim())
      .map((r) => ({
        response: r,
        date: new Date(r.submitted_at).toLocaleDateString('ko-KR'),
        branch: r.branch_name,
        content: String(r[field]),
        gender: r.gender,
        ageGroup: r.age_group,
        visitType: r.visit_type,
        scoreOverall: r.score_overall,
        lowestScore: getLowestScore(r),
      }))
  }, [responses, feedbackTab])

  // 점수 색상
  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'bg-green-500'
    if (score >= 4.0) return 'bg-green-400'
    if (score >= 3.5) return 'bg-yellow-400'
    if (score >= 3.0) return 'bg-orange-400'
    return 'bg-red-400'
  }

  return (
    <div className="space-y-5">
      {/* 오류 */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* ═══ 필터 바 ═══ */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="startDate" className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 w-36 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 w-36 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {([
              ['thisMonth', '이번달'],
              ['lastMonth', '저번달'],
              ['recent3months', '3개월'],
              ['thisYear', '올해'],
              ['lastYear', '작년'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleQuickDateRange(key)}
                className="px-2.5 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {userSession.role === '0000' && branches.length > 0 && (
            <div>
              <label htmlFor="branchId" className="block text-xs font-medium text-gray-500 mb-1">지점</label>
              <select
                id="branchId"
                value={branchId || ''}
                onChange={(e) => setBranchId(e.target.value || null)}
                className="border border-gray-300 rounded-lg px-3 py-2 w-36 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 지점</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <Button variant="primary" onClick={handleSearch} className="px-5 text-sm">
            조회
          </Button>
          {responses.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
            >
              CSV 내보내기
            </button>
          )}
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* ═══ 통계 영역 ═══ */}
      {stats && !loading && (
        <>
          {/* 요약 카드 */}
          <FormGrid columns={4}>
            <StatCard label="총 응답수" value={stats.total_count} unit="건" variant="primary" />
            <StatCard
              label="전반적 만족도"
              value={stats.avg_overall.toFixed(1)}
              unit="/ 5"
              variant={stats.avg_overall >= 4 ? 'success' : stats.avg_overall >= 3 ? 'warning' : 'danger'}
            />
            <StatCard
              label="상담 직원"
              value={stats.avg_consultation.toFixed(1)}
              unit="/ 5"
              variant={stats.avg_consultation >= 4 ? 'success' : 'warning'}
            />
            <StatCard
              label="시술 효과"
              value={stats.avg_result.toFixed(1)}
              unit="/ 5"
              variant={stats.avg_result >= 4 ? 'success' : 'warning'}
            />
          </FormGrid>

          {/* 항목별 만족도 + 월별 추이 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ContentCard title="항목별 만족도 평균">
              <div className="space-y-3">
                {Object.entries(SCORE_LABELS).map(([key, label]) => {
                  const score = stats[`avg_${key.replace('score_', '')}` as keyof SurveyStats] as number
                  const percent = (score / 5) * 100
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 w-28 shrink-0">{label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                        <div
                          className={`h-6 rounded-full transition-all duration-500 ${getScoreColor(score)}`}
                          style={{ width: `${percent}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">
                          {score > 0 ? score.toFixed(2) : '-'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ContentCard>

            <ContentCard title="월별 만족도 추이">
              <TrendChart data={stats.monthly_trend} />
            </ContentCard>
          </div>

          {/* 점수 분포 */}
          {Object.keys(stats.score_distribution).length > 0 && (
            <ContentCard title="점수 분포 (1~5점)">
              <div className="space-y-2.5">
                {Object.entries(SCORE_LABELS).map(([key, label]) => {
                  const dist = stats.score_distribution[key]
                  if (!dist) return null
                  return <ScoreDistBar key={key} label={label} dist={dist} />
                })}
              </div>
              <div className="flex items-center justify-end gap-3 mt-3 pt-2 border-t border-gray-100">
                {['1점', '2점', '3점', '4점', '5점'].map((lbl, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-sm ${DIST_BG[i]}`} />
                    <span className="text-[10px] text-gray-500">{lbl}</span>
                  </div>
                ))}
              </div>
            </ContentCard>
          )}

          {/* 인구통계 분포 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ContentCard title="성별 분포">
              <DistBars items={stats.gender_distribution} total={stats.total_count} color="bg-blue-400" />
            </ContentCard>
            <ContentCard title="연령대 분포">
              <DistBars items={stats.age_distribution} total={stats.total_count} color="bg-purple-400" />
            </ContentCard>
            <ContentCard title="방문유형 분포">
              <DistBars items={stats.visit_type_distribution} total={stats.total_count} color="bg-teal-400" labelWidth="w-24" />
            </ContentCard>
          </div>

          {/* 복수선택 통계 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ContentCard title="정보 채널 (복수선택)">
              <RankedBars items={stats.discovery_channel_distribution} color="bg-indigo-400" />
            </ContentCard>
            <ContentCard title="선택 이유 (복수선택)">
              <RankedBars items={stats.selection_reason_distribution} color="bg-emerald-400" />
            </ContentCard>
            <ContentCard title="피부 고민 / 시술 목적 (복수선택)">
              <RankedBars items={stats.skin_concern_distribution} color="bg-rose-400" />
            </ContentCard>
          </div>

          {/* ═══ 주관식 피드백 ═══ */}
          <ContentCard title="주관식 피드백">
            <div className="space-y-4">
              {/* 탭 */}
              <div className="flex gap-1 border-b border-gray-200 pb-2">
                {([
                  ['praise', '칭찬할 점', feedbackCounts.praise],
                  ['improvement', '개선사항', feedbackCounts.improvement],
                  ['comment', '하고 싶은 말', feedbackCounts.comment],
                ] as [FeedbackTab, string, number][]).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFeedbackTab(key)}
                    className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
                      feedbackTab === key
                        ? 'bg-blue-50 text-blue-700 font-semibold border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {label} <span className="text-xs ml-0.5">({count})</span>
                  </button>
                ))}
              </div>

              {/* 피드백 목록 */}
              {feedbackData.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">해당 피드백이 없습니다.</p>
              ) : (
                <div className="space-y-2.5 max-h-[480px] overflow-y-auto">
                  {feedbackData.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-100 hover:border-gray-300 transition-colors cursor-pointer"
                      onClick={() => setSelectedResponse(item.response)}
                    >
                      {/* 메타 정보 */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className="text-xs text-gray-500">{item.date}</span>
                        <span className="text-xs text-gray-300">|</span>
                        <span className="text-xs font-medium text-blue-600">{item.branch}</span>
                        {item.gender && (
                          <>
                            <span className="text-xs text-gray-300">|</span>
                            <span className="text-xs text-gray-500">{item.gender}</span>
                          </>
                        )}
                        {item.ageGroup && <span className="text-xs text-gray-500">{item.ageGroup}</span>}
                        {item.visitType && (
                          <span className="inline-block px-1.5 py-0.5 bg-gray-200 rounded text-[10px] text-gray-600">{item.visitType}</span>
                        )}
                        {item.scoreOverall != null && (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.scoreOverall >= 4 ? 'bg-green-100 text-green-700'
                            : item.scoreOverall >= 3 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            &#9733;{item.scoreOverall}
                          </span>
                        )}
                        {item.lowestScore && item.lowestScore.score <= 2 && (
                          <span className="inline-block px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px]">
                            {item.lowestScore.label} &#9733;{item.lowestScore.score}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ContentCard>
        </>
      )}

      {/* ═══ 전체 응답 목록 ═══ */}
      {responses.length > 0 && !loading && (
        <ContentCard title={`전체 응답 목록 (${responses.length}건)`}>
          <p className="text-xs text-gray-400 mb-2">행을 클릭하면 상세 정보를 확인할 수 있습니다.</p>
          <ReportGrid
            data={responses}
            columnDefs={columnDefs}
            emptyMessage="조회 버튼을 클릭하여 데이터를 조회하세요."
            paginationPageSize={20}
            onRowClicked={(e: any) => setSelectedResponse(e.data)}
            height="700px"
          />
        </ContentCard>
      )}

      {/* 초기 상태 */}
      {!loading && responses.length === 0 && !error && !stats && (
        <div className="flex items-center justify-center h-48 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-400 text-sm">조회 버튼을 클릭하여 만족도 조사 결과를 확인하세요.</p>
        </div>
      )}

      {/* ═══ 상세 모달 ═══ */}
      <SurveyDetailModal
        response={selectedResponse}
        onClose={() => setSelectedResponse(null)}
      />
    </div>
  )
}

// ─── 공통 서브 컴포넌트 ──────────────────────────────────────

/** 단순 분포 바 (성별, 연령대, 방문유형) */
function DistBars({ items, total, color, labelWidth = 'w-16' }: {
  items: { label: string; count: number }[]
  total: number
  color: string
  labelWidth?: string
}) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`text-xs text-gray-700 ${labelWidth} shrink-0 truncate`}>{item.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-5">
            <div
              className={`h-5 rounded-full ${color} transition-all duration-500`}
              style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-[70px] text-right shrink-0">
            {item.count} ({total > 0 ? ((item.count / total) * 100).toFixed(0) : 0}%)
          </span>
        </div>
      ))}
    </div>
  )
}

/** 순위형 바 (복수선택 통계) */
function RankedBars({ items, color }: {
  items: { label: string; count: number }[]
  color: string
}) {
  const maxCount = items[0]?.count || 1
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="text-xs text-gray-700 w-[140px] shrink-0 truncate" title={item.label}>{item.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-5 min-w-0">
            <div
              className={`h-5 rounded-full ${color} transition-all duration-500`}
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-12 text-right shrink-0">{item.count.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

/** 가장 낮은 점수 찾기 */
function getLowestScore(r: SurveyResponse): { label: string; score: number } | null {
  const fields: [keyof SurveyResponse, string][] = [
    ['score_consultation', '상담'],
    ['score_staff', '직원'],
    ['score_wait_time', '대기'],
    ['score_procedure', '시술'],
    ['score_result', '효과'],
    ['score_overall', '전반'],
  ]
  let lowest: { label: string; score: number } | null = null
  for (const [key, label] of fields) {
    const val = r[key] as number | null
    if (val != null && (lowest === null || val < lowest.score)) {
      lowest = { label, score: val }
    }
  }
  return lowest
}
