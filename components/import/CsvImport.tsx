'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { ContentCard } from '@/components/ui/Card'
import { importPurchases, importSales } from '@/app/admin/import/actions'

interface Branch {
  id: string
  code: string
  name: string
}

interface Product {
  id: string
  code: string
  name: string
}

interface Client {
  id: string
  code: string
  name: string
}

interface Session {
  user_id: string
  branch_id: string
  branch_name: string
  role: string
}

interface Props {
  session: Session
  branches: Branch[]
  products: Product[]
  clients: Client[]
}

type ImportType = 'purchase' | 'sale'
type Step = 'settings' | 'upload' | 'validate' | 'import'

interface ParsedRow {
  groupKey: string        // 일자-No. 원본
  date: string            // YYYY-MM-DD
  productCode: string
  productName: string
  quantity: number
  unitPrice: number       // 단가 (구매: unit_cost, 판매: unit_price)
  supplyPrice: number
  taxAmount: number
  totalPrice: number
  clientName: string      // 거래처명
  clientCode: string      // 거래처코드 (판매 CSV만)
  notes: string
  // 매칭 결과
  productId: string | null
  clientId: string | null
  productMatch: boolean
  clientMatch: boolean
}

interface TransactionGroup {
  groupKey: string
  date: string
  clientName: string
  clientCode: string
  clientId: string | null
  clientMatch: boolean
  items: ParsedRow[]
}

interface ImportResult {
  groupKey: string
  success: boolean
  message: string
}

export function CsvImport({ session, branches, products, clients }: Props) {
  const [step, setStep] = useState<Step>('settings')
  const [importType, setImportType] = useState<ImportType>('purchase')
  const [branchId, setBranchId] = useState(session.branch_id || '')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [groups, setGroups] = useState<TransactionGroup[]>([])
  const [skippedCount, setSkippedCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [fileName, setFileName] = useState('')

  const isAdmin = session.role === '0000'

  // 품목코드 → product_id 맵
  const productMap = new Map(products.map(p => [p.code, p.id]))
  const productNameMap = new Map(products.map(p => [p.code, p.name]))

  // 거래처 맵
  const clientByName = new Map(clients.map(c => [c.name, c.id]))
  const clientByCode = new Map(clients.map(c => [c.code, c.id]))
  const clientNameByCode = new Map(clients.map(c => [c.code, c.name]))

  const parseNumber = (val: string | undefined | null): number => {
    if (!val || val.trim() === '') return 0
    return Number(val.replace(/,/g, '')) || 0
  }

  const parseDate = (dateNoStr: string): string => {
    // "2026/01/02 -1" → "2026-01-02"
    const match = dateNoStr.match(/(\d{4})\/(\d{2})\/(\d{2})/)
    if (!match) return ''
    return `${match[1]}-${match[2]}-${match[3]}`
  }

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    Papa.parse(file, {
      encoding: 'euc-kr',
      complete: (result) => {
        const rawRows = result.data as string[][]
        if (rawRows.length < 2) {
          alert('CSV 파일에 데이터가 없습니다.')
          return
        }

        // 판매 CSV: 1행이 회사명 헤더인지 감지
        let dataStartIdx = 0
        let headerRow = rawRows[0]

        // 판매 CSV의 경우 1행이 "회사명 : ..." 형태
        if (importType === 'sale' && rawRows[0]?.[0]?.includes('회사명')) {
          dataStartIdx = 2 // 0행=회사명, 1행=헤더
          headerRow = rawRows[1]
        } else {
          dataStartIdx = 1 // 0행=헤더
          headerRow = rawRows[0]
        }

        const rows: ParsedRow[] = []
        let skipped = 0

        for (let i = dataStartIdx; i < rawRows.length; i++) {
          const row = rawRows[i]
          if (!row || row.length < 3) { skipped++; continue }

          const dateNoRaw = (row[0] || '').trim()

          // 스킵 규칙
          if (!dateNoRaw) { skipped++; continue }
          if (dateNoRaw.includes('계')) { skipped++; continue }

          const date = parseDate(dateNoRaw)
          if (!date) { skipped++; continue }

          let productCode: string
          let productName: string
          let quantity: number
          let unitPrice: number
          let supplyPrice: number
          let taxAmount: number
          let totalPrice: number
          let clientName: string
          let clientCode: string
          let notes: string

          if (importType === 'purchase') {
            // 구매 CSV: 일자-No., 품목코드, 품목그룹1명, 품목명(규격), 수량, 단가, 공급가액, 부가세, 합계, 거래처명, 적요
            productCode = (row[1] || '').trim()
            productName = (row[3] || '').trim()
            quantity = parseNumber(row[4])
            unitPrice = parseNumber(row[5])
            supplyPrice = parseNumber(row[6])
            taxAmount = parseNumber(row[7])
            totalPrice = parseNumber(row[8])
            clientName = (row[9] || '').trim()
            clientCode = ''
            notes = (row[10] || '').trim()
          } else {
            // 판매 CSV: 일자-No., 품목그룹1명, 품목명(규격), 거래처코드, 품목코드, 수량, 단가, 공급가액, 부가세, 합계, 거래처명, 적요
            productCode = (row[4] || '').trim()
            productName = (row[2] || '').trim()
            quantity = parseNumber(row[5])
            unitPrice = parseNumber(row[6])
            supplyPrice = parseNumber(row[7])
            taxAmount = parseNumber(row[8])
            totalPrice = parseNumber(row[9])
            clientName = (row[10] || '').trim()
            clientCode = (row[3] || '').trim()
            notes = (row[11] || '').trim()
          }

          // 품목코드 없으면 스킵
          if (!productCode) { skipped++; continue }

          // 수량 0이면 스킵
          if (quantity === 0) { skipped++; continue }

          const productId = productMap.get(productCode) || null
          let clientId: string | null = null
          if (importType === 'purchase') {
            clientId = clientByName.get(clientName) || null
          } else {
            clientId = clientByCode.get(clientCode) || null
          }

          rows.push({
            groupKey: dateNoRaw,
            date,
            productCode,
            productName,
            quantity,
            unitPrice,
            supplyPrice,
            taxAmount,
            totalPrice,
            clientName,
            clientCode,
            notes,
            productId,
            clientId,
            productMatch: !!productId,
            clientMatch: !!clientId
          })
        }

        setSkippedCount(skipped)
        setParsedRows(rows)

        // 그룹핑
        const groupMap = new Map<string, ParsedRow[]>()
        for (const row of rows) {
          const existing = groupMap.get(row.groupKey) || []
          existing.push(row)
          groupMap.set(row.groupKey, existing)
        }

        const txGroups: TransactionGroup[] = []
        for (const [key, items] of groupMap) {
          const first = items[0]
          txGroups.push({
            groupKey: key,
            date: first.date,
            clientName: first.clientName,
            clientCode: first.clientCode,
            clientId: first.clientId,
            clientMatch: first.clientMatch,
            items
          })
        }

        setGroups(txGroups)
        setStep('validate')
      },
      error: (err) => {
        alert(`CSV 파싱 오류: ${err.message}`)
      }
    })

    // 파일 input 리셋
    e.target.value = ''
  }, [importType, productMap, clientByName, clientByCode])

  const unmatchedProducts = parsedRows.filter(r => !r.productMatch)
  const unmatchedClients = groups.filter(g => !g.clientMatch)
  const hasErrors = unmatchedProducts.length > 0

  const handleImport = async () => {
    if (hasErrors) {
      alert('품목 매칭 실패 건이 있습니다. 먼저 해결해주세요.')
      return
    }

    if (!branchId) {
      alert('지점을 선택해주세요.')
      return
    }

    setImporting(true)
    setImportProgress(0)
    setImportResults([])
    setStep('import')

    const results: ImportResult[] = []
    const total = groups.length

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]
      setImportProgress(i + 1)

      try {
        let result: { success: boolean; message: string }

        if (importType === 'purchase') {
          result = await importPurchases({
            branch_id: branchId,
            client_id: group.clientId,
            purchase_date: group.date,
            created_by: session.user_id,
            items: group.items.map(item => ({
              product_id: item.productId!,
              quantity: item.quantity,
              unit_cost: item.unitPrice,
              supply_price: item.supplyPrice,
              tax_amount: item.taxAmount,
              total_price: item.totalPrice,
              notes: item.notes
            }))
          })
        } else {
          result = await importSales({
            branch_id: branchId,
            client_id: group.clientId,
            sale_date: group.date,
            created_by: session.user_id,
            items: group.items.map(item => ({
              product_id: item.productId!,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              supply_price: item.supplyPrice,
              tax_amount: item.taxAmount,
              total_price: item.totalPrice,
              notes: item.notes
            }))
          })
        }

        results.push({
          groupKey: group.groupKey,
          success: result.success,
          message: result.message || ''
        })
      } catch (err) {
        results.push({
          groupKey: group.groupKey,
          success: false,
          message: err instanceof Error ? err.message : '알 수 없는 오류'
        })
      }
    }

    setImportResults(results)
    setImporting(false)
  }

  const reset = () => {
    setStep('settings')
    setParsedRows([])
    setGroups([])
    setSkippedCount(0)
    setImportProgress(0)
    setImportResults([])
    setFileName('')
  }

  const successCount = importResults.filter(r => r.success).length
  const failCount = importResults.filter(r => !r.success).length

  return (
    <div className="space-y-6">
      {/* Step 1: 설정 */}
      {step === 'settings' && (
        <ContentCard>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">1. 설정</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">지점 선택</label>
              {isAdmin ? (
                <select
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- 지점 선택 --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900">
                  {session.branch_name}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">구분</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setImportType('purchase')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                    importType === 'purchase'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  구매(입고)
                </button>
                <button
                  onClick={() => setImportType('sale')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                    importType === 'sale'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  판매
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-900 mb-1">2. CSV 파일 업로드</label>
            <div className="mt-1">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={!branchId}
                className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
              {!branchId && (
                <p className="text-xs text-red-500 mt-1">먼저 지점을 선택해주세요.</p>
              )}
            </div>
            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-900">
              <p className="font-medium mb-1">CSV 형식 안내:</p>
              {importType === 'purchase' ? (
                <p>일자-No., 품목코드, 품목그룹1명, 품목명(규격), 수량, 단가, 공급가액, 부가세, 합계, 거래처명, 적요</p>
              ) : (
                <>
                  <p>1행: 회사명 헤더 (자동 스킵)</p>
                  <p>2행: 일자-No., 품목그룹1명, 품목명(규격), 거래처코드, 품목코드, 수량, 단가, 공급가액, 부가세, 합계, 거래처명, 적요</p>
                </>
              )}
            </div>
          </div>
        </ContentCard>
      )}

      {/* Step 2: 검증 결과 */}
      {step === 'validate' && (
        <>
          <ContentCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">검증 결과</h2>
              <button
                onClick={reset}
                className="text-sm text-gray-900 hover:text-gray-900"
              >
                다시 시작
              </button>
            </div>

            {/* 요약 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{groups.length}</div>
                <div className="text-xs text-blue-600">거래 건수</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{parsedRows.length}</div>
                <div className="text-xs text-green-600">품목 행수</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{skippedCount}</div>
                <div className="text-xs text-gray-900">스킵 행수</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${unmatchedProducts.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className={`text-2xl font-bold ${unmatchedProducts.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {unmatchedProducts.length}
                </div>
                <div className={`text-xs ${unmatchedProducts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  품목 매칭실패
                </div>
              </div>
              <div className={`rounded-lg p-3 text-center ${unmatchedClients.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                <div className={`text-2xl font-bold ${unmatchedClients.length > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                  {unmatchedClients.length}
                </div>
                <div className={`text-xs ${unmatchedClients.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  거래처 매칭실패
                </div>
              </div>
            </div>

            {/* 매칭 실패 품목 상세 */}
            {unmatchedProducts.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-sm font-semibold text-red-800 mb-2">
                  품목 매칭 실패 ({unmatchedProducts.length}건) - 등록 불가
                </h3>
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-red-700">
                        <th className="text-left py-1">품목코드</th>
                        <th className="text-left py-1">품목명</th>
                        <th className="text-left py-1">일자-No.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmatchedProducts.map((row, i) => (
                        <tr key={i} className="border-t border-red-100">
                          <td className="py-1 font-mono">{row.productCode}</td>
                          <td className="py-1">{row.productName}</td>
                          <td className="py-1">{row.groupKey}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 매칭 실패 거래처 (경고) */}
            {unmatchedClients.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="text-sm font-semibold text-yellow-800 mb-2">
                  거래처 매칭 실패 ({unmatchedClients.length}건) - 거래처 없이 등록됩니다
                </h3>
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-yellow-700">
                        <th className="text-left py-1">일자-No.</th>
                        <th className="text-left py-1">거래처명</th>
                        <th className="text-left py-1">거래처코드</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmatchedClients.map((g, i) => (
                        <tr key={i} className="border-t border-yellow-100">
                          <td className="py-1">{g.groupKey}</td>
                          <td className="py-1">{g.clientName}</td>
                          <td className="py-1 font-mono">{g.clientCode || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </ContentCard>

          {/* 거래 그룹 미리보기 */}
          <ContentCard>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              거래 내역 미리보기 ({groups.length}건)
            </h2>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-2">일자-No.</th>
                    <th className="text-left py-2 px-2">날짜</th>
                    <th className="text-left py-2 px-2">거래처</th>
                    <th className="text-right py-2 px-2">품목수</th>
                    <th className="text-right py-2 px-2">총 수량</th>
                    <th className="text-right py-2 px-2">합계금액</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, i) => {
                    const totalQty = g.items.reduce((s, item) => s + item.quantity, 0)
                    const totalAmt = g.items.reduce((s, item) => s + item.totalPrice, 0)
                    const hasUnmatched = g.items.some(item => !item.productMatch)

                    return (
                      <tr
                        key={i}
                        className={`border-t ${hasUnmatched ? 'bg-red-50' : ''} ${!g.clientMatch ? 'text-yellow-700' : ''}`}
                      >
                        <td className="py-2 px-2 font-mono text-xs">{g.groupKey}</td>
                        <td className="py-2 px-2">{g.date}</td>
                        <td className="py-2 px-2">
                          {g.clientMatch ? (
                            g.clientName
                          ) : (
                            <span className="text-yellow-600">{g.clientName || g.clientCode || '(없음)'}</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">{g.items.length}</td>
                        <td className="py-2 px-2 text-right">{totalQty.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right">{totalAmt.toLocaleString()}원</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleImport}
                disabled={hasErrors}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {hasErrors
                  ? '품목 매칭 실패 해결 필요'
                  : `${groups.length}건 등록 시작`
                }
              </button>
            </div>
          </ContentCard>
        </>
      )}

      {/* Step 3: 등록 진행/결과 */}
      {step === 'import' && (
        <ContentCard>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {importing ? '등록 진행 중...' : '등록 완료'}
          </h2>

          {/* 진행률 */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-900 mb-1">
              <span>{importProgress} / {groups.length}</span>
              <span>{Math.round((importProgress / groups.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(importProgress / groups.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 결과 요약 */}
          {!importing && importResults.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{successCount}</div>
                  <div className="text-xs text-green-600">성공</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${failCount > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className={`text-2xl font-bold ${failCount > 0 ? 'text-red-700' : 'text-green-700'}`}>{failCount}</div>
                  <div className={`text-xs ${failCount > 0 ? 'text-red-600' : 'text-green-600'}`}>실패</div>
                </div>
              </div>

              {/* 실패 건 상세 */}
              {failCount > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-red-800 mb-2">실패 건 상세</h3>
                  <div className="max-h-40 overflow-y-auto text-xs">
                    {importResults.filter(r => !r.success).map((r, i) => (
                      <div key={i} className="py-1 border-t border-red-100">
                        <span className="font-mono">{r.groupKey}</span>: {r.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={reset}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  새로운 파일 가져오기
                </button>
              </div>
            </>
          )}
        </ContentCard>
      )}
    </div>
  )
}
