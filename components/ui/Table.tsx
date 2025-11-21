import React from 'react';

export interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table = ({ children, className = '' }: TableProps) => {
  return (
    <div className="w-full overflow-auto">
      <table className={`w-full text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
};

export interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHeader = ({ children, className = '' }: TableHeaderProps) => {
  return (
    <thead className={`bg-gray-50 border-b border-gray-200 ${className}`}>
      {children}
    </thead>
  );
};

export interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody = ({ children, className = '' }: TableBodyProps) => {
  return (
    <tbody className={`divide-y divide-gray-200 ${className}`}>
      {children}
    </tbody>
  );
};

export interface TableRowProps {
  children: React.ReactNode;
  className?: string;
}

export const TableRow = ({ children, className = '' }: TableRowProps) => {
  return (
    <tr className={`hover:bg-gray-50 ${className}`}>
      {children}
    </tr>
  );
};

export interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHead = ({ children, className = '' }: TableHeadProps) => {
  return (
    <th className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
};

export interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

export const TableCell = ({ children, className = '' }: TableCellProps) => {
  return (
    <td className={`px-4 py-3 text-gray-900 ${className}`}>
      {children}
    </td>
  );
};

export default Table;
