import React from 'react';
import { Loan } from '../../mock/data';
import { IncomeModal } from './IncomeModal';
import { ExpenseModal } from './ExpenseModal';
import { TransferModal } from './TransferModal';
import { LoanModal } from './LoanModal';
import { RepaymentModal } from './RepaymentModal';
import { DailyBulkModal } from './DailyBulkModal';

interface ActionModalsProps {
  activeModal: 'income' | 'expense' | 'transfer' | 'loan' | 'daily_bulk' | 'repayment' | null;
  onClose: () => void;
  selectedLoanForRepayment?: Loan | null;
  onSuccessNotification?: (msg: string) => void;
}

// Only the open modal is mounted, so each one starts from a clean form with current accounts.
export const ActionModals: React.FC<ActionModalsProps> = ({
  activeModal,
  onClose,
  selectedLoanForRepayment,
  onSuccessNotification,
}) => {
  switch (activeModal) {
    case 'income':
      return <IncomeModal onClose={onClose} />;
    case 'expense':
      return <ExpenseModal onClose={onClose} />;
    case 'transfer':
      return <TransferModal onClose={onClose} />;
    case 'loan':
      return <LoanModal onClose={onClose} />;
    case 'repayment':
      return <RepaymentModal onClose={onClose} selectedLoanForRepayment={selectedLoanForRepayment} />;
    case 'daily_bulk':
      return <DailyBulkModal onClose={onClose} onSuccessNotification={onSuccessNotification} />;
    default:
      return null;
  }
};
