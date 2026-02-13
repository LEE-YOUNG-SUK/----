import React from 'react'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabNavProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
}

/**
 * 탭 네비게이션 통일 컴포넌트
 */
export function TabNav({ tabs, activeTab, onChange }: TabNavProps) {
  return (
    <div className="bg-white border-b">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-900 hover:text-gray-900'
            }`}
          >
            {tab.label} {tab.count !== undefined && `(${tab.count})`}
          </button>
        ))}
      </div>
    </div>
  )
}
