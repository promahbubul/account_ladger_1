import React from 'react';
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Inbox,
  Plus,
} from 'lucide-react';

interface TableStateRowProps {
  colSpan: number;
  children: React.ReactNode;
  minHeightClass?: string;
}

export const TableStateContainer: React.FC<{ children: React.ReactNode; minHeightClass?: string }> = ({
  children,
  minHeightClass = 'min-h-[260px]',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center w-full ${minHeightClass} py-12 px-4 text-center select-none`}>
      {children}
    </div>
  );
};

export interface TableErrorRowProps {
  colSpan: number;
  title?: string;
  description?: string | null;
  onRetry?: () => void;
  minHeightClass?: string;
}

export const TableErrorRow: React.FC<TableErrorRowProps> = ({
  colSpan,
  title = 'Failed to load data',
  description,
  onRetry,
  minHeightClass = 'min-h-[260px]',
}) => {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-0">
        <TableStateContainer minHeightClass={minHeightClass}>
          <div className="w-8 h-8 rounded-full bg-red-950/60 border border-red-800/80 flex items-center justify-center mb-2.5">
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-xs font-medium text-red-300 mb-1">{title}</p>
          {description && (
            <p className="text-[11px] text-gray-400 max-w-md line-clamp-2 mb-3">
              {description}
            </p>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1b1e25] hover:bg-[#232732] text-gray-200 border border-[#2d313d] hover:border-gray-500 rounded text-xs font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-gray-400" />
              <span>Retry</span>
            </button>
          )}
        </TableStateContainer>
      </td>
    </tr>
  );
};

export interface TableLoadingRowProps {
  colSpan: number;
  message?: string;
  minHeightClass?: string;
}

export const TableLoadingRow: React.FC<TableLoadingRowProps> = ({
  colSpan,
  message = 'Loading records...',
  minHeightClass = 'min-h-[260px]',
}) => {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-0">
        <TableStateContainer minHeightClass={minHeightClass}>
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin mb-2" />
          <p className="text-xs text-gray-400 font-medium">{message}</p>
        </TableStateContainer>
      </td>
    </tr>
  );
};

export interface TableEmptyRowProps {
  colSpan: number;
  title?: string;
  description?: string | null;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  icon?: React.ReactNode;
  minHeightClass?: string;
}

export const TableEmptyRow: React.FC<TableEmptyRowProps> = ({
  colSpan,
  title = 'No records found',
  description,
  action,
  icon,
  minHeightClass = 'min-h-[260px]',
}) => {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-0">
        <TableStateContainer minHeightClass={minHeightClass}>
          <div className="w-8 h-8 rounded-full bg-[#16181d] border border-[#262933] flex items-center justify-center mb-2.5">
            {icon || <Inbox className="w-4 h-4 text-gray-500" />}
          </div>
          <p className="text-xs font-medium text-gray-300 mb-1">{title}</p>
          {description && (
            <p className="text-[11px] text-gray-500 max-w-sm mb-3">
              {description}
            </p>
          )}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors cursor-pointer"
            >
              {action.icon || <Plus className="w-3.5 h-3.5" />}
              <span>{action.label}</span>
            </button>
          )}
        </TableStateContainer>
      </td>
    </tr>
  );
};

export interface PageErrorStateProps {
  title?: string;
  description?: string | null;
  onRetry?: () => void;
}

export const PageErrorState: React.FC<PageErrorStateProps> = ({
  title = 'Something went wrong',
  description,
  onRetry,
}) => {
  return (
    <div className="flex-1 w-full min-h-[300px] flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-10 h-10 rounded-full bg-red-950/60 border border-red-800/80 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5 text-red-400" />
      </div>
      <h3 className="text-sm font-semibold text-red-200 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-gray-400 max-w-md mb-4">{description}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1b1e25] hover:bg-[#232732] text-gray-200 border border-[#2d313d] hover:border-gray-500 rounded text-xs font-medium transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};

export interface PageLoadingStateProps {
  message?: string;
}

export const PageLoadingState: React.FC<PageLoadingStateProps> = ({
  message = 'Loading content...',
}) => {
  return (
    <div className="flex-1 w-full min-h-[300px] flex flex-col items-center justify-center py-16 px-4 text-center">
      <Loader2 className="w-6 h-6 text-blue-400 animate-spin mb-2.5" />
      <p className="text-xs text-gray-400 font-medium">{message}</p>
    </div>
  );
};

export interface PageEmptyStateProps {
  title?: string;
  description?: string | null;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  icon?: React.ReactNode;
}

export const PageEmptyState: React.FC<PageEmptyStateProps> = ({
  title = 'No data available',
  description,
  action,
  icon,
}) => {
  return (
    <div className="flex-1 w-full min-h-[300px] flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-10 h-10 rounded-full bg-[#16181d] border border-[#262933] flex items-center justify-center mb-3">
        {icon || <Inbox className="w-5 h-5 text-gray-500" />}
      </div>
      <h3 className="text-sm font-semibold text-gray-200 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors cursor-pointer"
        >
          {action.icon || <Plus className="w-3.5 h-3.5" />}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};
