import React from 'react'

export interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

export interface TabsListProps {
  children: React.ReactNode
  className?: string
}

export interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

export interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
}>({
  value: '',
  onValueChange: () => {}
})

export const Tabs = ({ value, onValueChange, children, className = '' }: TabsProps) => {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export const TabsList = ({ children, className = '' }: TabsListProps) => {
  return (
    <div className={`inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 ${className}`}>
      {children}
    </div>
  )
}

export const TabsTrigger = ({ value, children, className = '' }: TabsTriggerProps) => {
  const { value: currentValue, onValueChange } = React.useContext(TabsContext)
  const isActive = currentValue === value

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5
        text-sm font-medium ring-offset-white transition-all
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        disabled:pointer-events-none disabled:opacity-50
        ${isActive 
          ? 'bg-white text-gray-900 shadow-sm' 
          : 'text-gray-900 hover:bg-gray-200 hover:text-gray-900'
        }
        ${className}
      `}
    >
      {children}
    </button>
  )
}

export const TabsContent = ({ value, children, className = '' }: TabsContentProps) => {
  const { value: currentValue } = React.useContext(TabsContext)

  if (currentValue !== value) {
    return null
  }

  return (
    <div className={className}>
      {children}
    </div>
  )
}

