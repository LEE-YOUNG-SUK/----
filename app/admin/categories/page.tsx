import { requirePermission } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import CategoryManagement from '@/components/admin/categories/CategoryManagement'
import { getCategories } from './actions'
import { ContentCard } from '@/components/ui/Card'

export const metadata = {
  title: '카테고리 관리 - DR.Evers ERP',
  description: '품목 카테고리 관리',
}

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const userData = await requirePermission('admin_settings', 'read')

  // 카테고리 목록 조회
  const categories = await getCategories()

  return (
    <>
      <NavigationWrapper user={userData} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <ContentCard>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">🏷️ 카테고리 관리</h1>
                  <p className="text-sm text-gray-900 mt-1">
                    품목 카테고리를 등록하고 관리합니다
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-gray-900">
                    시스템 관리자
                  </div>
                </div>
              </div>
            </ContentCard>

            <CategoryManagement 
              initialCategories={categories}
            />
          </div>
        </div>
      </div>
    </>
  )
}

