import { Loan, LoanRepayment } from '../../mock/data';
import type { FinanceActionContext } from './types';
import { getErrorMessage } from '../../lib/errors';

export const createLoanActions = ({ accounts, loans, setAccounts, setLoans, setRepayments, authFetch }: FinanceActionContext) => {
  // LOANS
  const addLoan = async (loan: {
    type: 'LENT' | 'BORROWED';
    counterpartyName: string;
    counterpartyContact?: string;
    principalAmount: number;
    accountId: string;
    startDate: string;
    dueDate?: string;
    notes?: string;
    interestRate?: number;
  }): Promise<{ success: boolean; loan?: Loan; error?: string }> => {
    const acc = accounts.find((a) => a.id === loan.accountId);
    if (!acc) return { success: false, error: 'Account not found.' };

    try {
      const res = await authFetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loan),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to save loan' };
      }

      const created: Loan = data.loan;
      setLoans((prev) => [created, ...prev]);

      const delta = loan.type === 'LENT' ? -loan.principalAmount : loan.principalAmount;
      setAccounts((prev) =>
        prev.map((a) => (a.id === loan.accountId ? { ...a, currentBalance: a.currentBalance + delta } : a))
      );

      return { success: true, loan: created };
    } catch (err: unknown) {
      console.error('Error creating loan:', err);
      return { success: false, error: getErrorMessage(err) || 'Error creating loan' };
    }
  };

  const deleteLoan = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const target = loans.find((l) => l.id === id);
      const res = await authFetch(`/api/loans/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete loan' };
      }

      setLoans((prev) => prev.filter((l) => l.id !== id));
      if (target) {
        const reverse = target.type === 'LENT' ? target.principalAmount : -target.principalAmount;
        setAccounts((prev) =>
          prev.map((a) => (a.id === target.accountId ? { ...a, currentBalance: a.currentBalance + reverse } : a))
        );
      }
      return { success: true };
    } catch (err: unknown) {
      console.error('Error deleting loan:', err);
      return { success: false, error: getErrorMessage(err) || 'Error deleting loan' };
    }
  };

  const recordRepayment = async (repayment: {
    loanId: string;
    accountId: string;
    amount: number;
    date: string;
    notes?: string;
  }): Promise<{ success: boolean; repayment?: LoanRepayment; error?: string }> => {
    const loan = loans.find((l) => l.id === repayment.loanId);
    const acc = accounts.find((a) => a.id === repayment.accountId);
    if (!loan || !acc) return { success: false, error: 'Loan or Account not found.' };

    try {
      const res = await authFetch(`/api/loans/${repayment.loanId}/repayments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(repayment),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to record repayment' };
      }

      const repObj: LoanRepayment = data.repayment || {
        id: `rep_${Date.now()}`,
        loanId: loan.id,
        counterpartyName: loan.counterpartyName,
        loanType: loan.type,
        amount: repayment.amount,
        date: repayment.date,
        accountName: acc.name,
        notes: repayment.notes,
      };

      setRepayments((prev) => [repObj, ...prev]);

      // Update loan balance
      setLoans((prev) =>
        prev.map((l) => {
          if (l.id === repayment.loanId) {
            const newOutstanding = Math.max(0, l.outstandingPrincipal - repayment.amount);
            return {
              ...l,
              outstandingPrincipal: newOutstanding,
              status: newOutstanding <= 0 ? 'SETTLED' : 'PARTIALLY_REPAID',
            };
          }
          return l;
        })
      );

      // Update account balance
      const delta = loan.type === 'LENT' ? repayment.amount : -repayment.amount;
      setAccounts((prev) =>
        prev.map((a) => (a.id === repayment.accountId ? { ...a, currentBalance: a.currentBalance + delta } : a))
      );

      return { success: true, repayment: repObj };
    } catch (err: unknown) {
      console.error('Error recording repayment:', err);
      return { success: false, error: getErrorMessage(err) || 'Error recording repayment' };
    }
  };

  return { addLoan, deleteLoan, recordRepayment };
};
