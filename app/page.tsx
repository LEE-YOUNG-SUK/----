import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { ROLE_LABELS, ROLE_ICONS } from '@/types/permissions'
import { PageLayout } from '@/components/shared/PageLayout'
import { ContentCard } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireSession()
  
  return (
    <>
      <NavigationWrapper user={session} />
      <PageLayout>
        <div className="space-y-6">
          
          {/* 환영 메시지 */}
          <ContentCard>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {'환영합니다, '}{session.display_name}{'님! 👋'}
            </h2>
            <p className="text-gray-900">
              {session.branch_name} | {session.role === '0000' ? '시스템관리자' : session.role === '0001' ? '원장' : session.role === '0002' ? '매니저' : '사용자'}
            </p>
          </ContentCard>
          
          {/* 사용자 정보 */}
          <ContentCard title="📋 사용자 정보">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-1">소속 지점</p>
                <p className="text-lg font-medium text-green-900">
                  {session.branch_name || '전체 지점'}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 mb-1">아이디</p>
                <p className="text-lg font-medium text-blue-900">{session.username}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 mb-1">이름</p>
                <p className="text-lg font-medium text-blue-900">{session.display_name}</p>
              </div>
            </div>
          </ContentCard>
          
          {/* 빠른 링크 */}
          <ContentCard title="🚀 빠른 시작">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <a href="/purchases" className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition border border-blue-200">
                <div className="text-2xl mb-2">{'📥'}</div>
                <div className="font-medium text-blue-900">입고 관리</div>
                <div className="text-sm text-blue-600">상품 입고 등록</div>
              </a>
              
              <a href="/sales" className="block p-4 bg-green-50 rounded-lg hover:bg-green-100 transition border border-green-200">
                <div className="text-2xl mb-2">{'📤'}</div>
                <div className="font-medium text-green-900">판매 관리</div>
                <div className="text-sm text-green-600">상품 판매 등록</div>
              </a>
              
              <a href="/inventory" className="block p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition border border-purple-200">
                <div className="text-2xl mb-2">{'📦'}</div>
                <div className="font-medium text-purple-900">재고 현황</div>
                <div className="text-sm text-purple-600">실시간 재고 조회</div>
              </a>

              <a href="/reports/surveys" className="block p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition border border-orange-200">
                <div className="text-2xl mb-2">{'📊'}</div>
                <div className="font-medium text-orange-900">고객만족도 조사</div>
                <div className="text-sm text-orange-600">만족도 통계 및 분석</div>
              </a>

            </div>
          </ContentCard>
          
        </div>
      </PageLayout>
    </>
  )
}