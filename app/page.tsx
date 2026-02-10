import { requireSession } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { ROLE_LABELS, ROLE_ICONS } from '@/types/permissions'
import { PageLayout } from '@/components/shared/PageLayout'
import { ContentCard } from '@/components/ui/Card'

export default async function DashboardPage() {
  const session = await requireSession()
  
  const isAdmin = session.role === '0000'
  const isBranchUser = ['0001', '0002', '0003'].includes(session.role)
  
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
            <p className="text-gray-600">
              DR.Evers ERP 시스템에 성공적으로 로그인하셨습니다.
            </p>
          </ContentCard>
          
          {/* 사용자 정보 */}
          <ContentCard title="📋 사용자 정보">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 mb-1">아이디</p>
                <p className="text-lg font-medium text-blue-900">{session.username}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 mb-1">이름</p>
                <p className="text-lg font-medium text-blue-900">{session.display_name}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-purple-600 mb-1">역할</p>
                <p className="text-lg font-medium text-purple-900">
                  {ROLE_ICONS[session.role]} {ROLE_LABELS[session.role]}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-1">소속 지점</p>
                <p className="text-lg font-medium text-green-900">
                  {session.branch_name || '전체 지점'}
                </p>
              </div>
            </div>
          </ContentCard>
          
          {/* 권한 안내 */}
          <ContentCard className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              {'🔐 권한 정보'}
            </h3>
            
            {isAdmin && (
              <div className="space-y-2 text-sm">
                <p className="text-blue-800">{'✅ 모든 지점 데이터 접근 가능'}</p>
                <p className="text-blue-800">{'✅ 사용자 관리 권한'}</p>
                <p className="text-blue-800">{'✅ 거래처/품목 생성/수정/삭제 권한'}</p>
                <p className="text-blue-800">{'✅ 모든 메뉴 접근 가능'}</p>
              </div>
            )}
            
            {isBranchUser && (
              <div className="space-y-2 text-sm">
                <p className="text-blue-800">{'✅ 소속 지점 데이터만 접근 가능'}</p>
                <p className="text-blue-800">{'✅ 입고/판매 전체 권한 (CRUD)'}</p>
                <p className="text-blue-800">{'✅ 재고 조회 권한'}</p>
                <p className="text-blue-800">{'⚠️ 거래처/품목 조회만 가능 (수정 불가)'}</p>
                <p className="text-blue-800">{'❌ 사용자 관리 불가'}</p>
              </div>
            )}
          </ContentCard>
          
          {/* Phase 3 완료 */}
          <ContentCard className="bg-green-50 border-green-200">
            <h3 className="font-semibold text-green-900 mb-2">
              {'✅ Phase 3 완료!'}
            </h3>
            <p className="text-green-700 text-sm mb-2">
              권한 시스템이 정상적으로 작동합니다.
            </p>
            <ul className="text-green-600 text-sm space-y-1 ml-6 list-disc">
              <li>4단계 역할 기반 권한</li>
              <li>권한별 메뉴 표시</li>
              <li>네비게이션 바</li>
              <li>권한 체크 시스템</li>
            </ul>
            <p className="text-green-600 text-sm mt-3 font-medium">
              {'🎯 다음: Phase 4 - 재고 현황 페이지'}
            </p>
          </ContentCard>
          
          {/* 빠른 링크 */}
          <ContentCard title="🚀 빠른 시작">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
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
              
            </div>
          </ContentCard>
          
        </div>
      </PageLayout>
    </>
  )
}