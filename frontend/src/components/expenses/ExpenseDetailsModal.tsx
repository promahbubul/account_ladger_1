import React from 'react';
import { formatBDT, formatDate } from '../../lib/formatters';
import { Transaction } from '../../mock/data';
import { Modal } from '../common/Modal';

export const ExpenseDetailsModal: React.FC<{ selectedTx: Transaction; onClose: () => void }> = ({ selectedTx, onClose }) => (
    <Modal
      isOpen
      onClose={onClose}
      title="Expense Details"
    >
      {(
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2 bg-app border border-line p-3 rounded">
            <div>
              <span className="text-gray-500 text-[10px] uppercase font-mono block">Date</span>
              <span className="font-semibold text-gray-200">{formatDate(selectedTx.date)}</span>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] uppercase font-mono block">Amount</span>
              <span className="font-semibold text-rose-400 font-mono text-sm">-{formatBDT(selectedTx.amount)}</span>
            </div>
            <div>
              <span className="text-gray-500 text-[10px] uppercase font-mono block">Category</span>
              <span className="text-gray-200">{selectedTx.category}</span>
              {selectedTx.subcategory && (
                <span className="text-blue-400 font-mono text-[10px] block">↳ {selectedTx.subcategory}</span>
              )}
            </div>
            <div>
              <span className="text-gray-500 text-[10px] uppercase font-mono block">Account</span>
              <span className="text-gray-200">{selectedTx.accountName}</span>
            </div>
          </div>

          <div>
            <span className="text-gray-500 text-[10px] uppercase font-mono block mb-1">Description</span>
            <p className="p-2.5 bg-app border border-line rounded text-gray-300">
              {selectedTx.description && selectedTx.description !== 'Daily Expense' ? selectedTx.description : (selectedTx.desc || (selectedTx.category ? `${selectedTx.category} Expense` : 'Expense'))}
            </p>
          </div>

          {selectedTx.reference && (
            <div>
              <span className="text-gray-500 text-[10px] uppercase font-mono block mb-1">Reference</span>
              <p className="p-2 bg-app border border-line rounded font-mono text-gray-400">{selectedTx.reference}</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-surface-hover hover:bg-surface-raised text-gray-300 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
);
