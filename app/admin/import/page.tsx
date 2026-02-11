import { requirePermission } from '@/lib/session'
import { NavigationWrapper } from '@/components/NavigationWrapper'
import { ContentCard } from '@/components/ui/Card'
import { CsvImport } from '@/components/import/CsvImport'
import { getImportData } from './actions'

export const metadata = {
  title: '데이터 가져오기 - DR.Evers ERP',
  description: 'CSV 파일에서 구매/판매 데이터 일괄 등록',
}

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  const userData = await requirePermission('purchases_management', 'create')

  const { branches, products, clients } = await getImportData()

  const safeData = {
    branches: JSON.parse(JSON.stringify(branches)),
    products: JSON.parse(JSON.stringify(products)),
    clients: JSON.parse(JSON.stringify(clients)),
  }

  const formSession = {
    user_id: userData.user_id,
    branch_id: userData.branch_id || '',
    branch_name: userData.branch_name || '',
    role: userData.role
  }

  return (
    <>
      <NavigationWrapper user={userData} />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <ContentCard>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">CSV 데이터 가져오기</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    구매/판매 CSV 파일을 업로드하여 일괄 등록합니다
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm text-gray-600">
                    품목: {safeData.products.length}개 | 거래처: {safeData.clients.length}개
                  </div>
                </div>
              </div>
            </ContentCard>

            <CsvImport
              session={formSession}
              branches={safeData.branches}
              products={safeData.products}
              clients={safeData.clients}
            />
          </div>
        </div>
      </div>
    </>
  )
}
