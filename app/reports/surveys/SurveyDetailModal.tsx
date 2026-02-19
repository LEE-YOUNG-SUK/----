'use client'

import type { SurveyResponse } from '@/types/survey'
import { SCORE_LABELS } from '@/types/survey'

interface Props {
  response: SurveyResponse | null
  onClose: () => void
}

function ScoreStars({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-400 text-sm">-</span>
  const color = score >= 4 ? 'text-green-500' : score >= 3 ? 'text-yellow-500' : 'text-red-500'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`text-sm ${i <= score ? color : 'text-gray-200'}`}>&#9733;</span>
      ))}
      <span className={`ml-1.5 text-sm font-bold ${color}`}>{score}</span>
    </div>
  )
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

function MultiSelectList({ label, value }: { label: string; value: string | null }) {
  if (!value || !value.trim()) return null
  const items = value.split(', ').map(s => s.trim()).filter(Boolean)
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="inline-block px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function FeedbackBlock({ label, text, color }: { label: string; text: string | null; color: string }) {
  if (!text || !text.trim()) return null
  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${color}`}>{label}</h4>
      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
        {text}
      </p>
    </div>
  )
}

export default function SurveyDetailModal({ response, onClose }: Props) {
  if (!response) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex justify-between items-center rounded-t-xl z-10">
          <h3 className="font-bold text-base text-gray-900">응답 상세</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-lg"
            aria-label="닫기"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Basic info badges */}
          <div className="flex flex-wrap gap-1.5">
            <Badge className="bg-gray-100 text-gray-700">
              {new Date(response.submitted_at).toLocaleDateString('ko-KR')}
            </Badge>
            <Badge className="bg-blue-50 text-blue-700">{response.branch_name}</Badge>
            {response.gender && (
              <Badge className="bg-purple-50 text-purple-700">{response.gender}</Badge>
            )}
            {response.age_group && (
              <Badge className="bg-orange-50 text-orange-700">{response.age_group}</Badge>
            )}
            {response.visit_type && (
              <Badge className="bg-teal-50 text-teal-700">{response.visit_type}</Badge>
            )}
            {response.visit_frequency && (
              <Badge className="bg-gray-50 text-gray-600">{response.visit_frequency}</Badge>
            )}
            {response.phone && (
              <Badge className="bg-gray-50 text-gray-500">{response.phone}</Badge>
            )}
          </div>

          {/* Scores */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">만족도 점수</h4>
            <div className="space-y-2">
              {Object.entries(SCORE_LABELS).map(([key, label]) => {
                const score = response[key as keyof SurveyResponse] as number | null
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 w-28 shrink-0">{label}</span>
                    <ScoreStars score={score} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Multi-select info */}
          <MultiSelectList label="정보 채널" value={response.discovery_channel} />
          <MultiSelectList label="선택 이유" value={response.selection_reason} />
          <MultiSelectList label="피부 고민 / 시술 목적" value={response.skin_concern} />

          {/* Feedback */}
          <div className="space-y-4">
            <FeedbackBlock label="칭찬할 점" text={response.feedback_praise} color="text-green-600" />
            <FeedbackBlock label="개선사항" text={response.feedback_improvement} color="text-orange-600" />
            <FeedbackBlock label="하고 싶은 말" text={response.feedback_comment} color="text-blue-600" />
          </div>

          {(!response.feedback_praise?.trim() && !response.feedback_improvement?.trim() && !response.feedback_comment?.trim()) && (
            <p className="text-sm text-gray-400 text-center py-2">작성된 주관식 피드백이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  )
}
