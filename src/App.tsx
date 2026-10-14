import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { AccountsView } from './components/accounts/AccountsView';
import { IncomeView } from './components/income/IncomeView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { BudgetsView } from './components/budgets/BudgetsView';
import { TransfersView } from './components/transfers/TransfersView';
import { LoansView } from './components/loans/LoansView';
import { CategoriesView } from './components/categories/CategoriesView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { AdminView } from './components/admin/AdminView';
import { ActionModals } from './components/modals/ActionModals';
import { LoginView } from './components/auth/LoginView';
import { Loan } from './mock/data';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { CheckCircle2, X, Wallet } from 'lucide-react';

function AppContent() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Initialize role-appropriate default tab
  const [currentTab, setCurrentTab] = useState<NavTab>(() => (isAdmin ? 'admin-dashboard' : 'dashboard'));
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Modal flow state (normal users only)
  const [activeModal, setActiveModal] = useState<'income' | 'expense' | 'transfer' | 'loan' | 'daily_bulk' | 'repayment' | null>(null);
  const [selectedLoanForRepayment, setSelectedLoanForRepayment] = useState<Loan | null>(null);

  // Notification toast state
  const [notification, setNotification] = useState<string | null>(null);

  const { budgetAlerts } = useFinance();
  const overBudgetCount = budgetAlerts.filter(b => b.status === 'EXCEEDED').length;

  // Strict route/tab guard when user or role changes
  useEffect(() => {
    if (isAdmin) {
      if (!currentTab.startsWith('admin-')) {
        setCurrentTab('admin-dashboard');
      }
    } else if (user) {
      if (currentTab.startsWith('admin-')) {
        setCurrentTab('dashboard');
      }
    }
  }, [isAdmin, user, currentTab]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0d0f12] text-gray-400 flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded bg-[#1a1d24] border border-[#2a2d36] flex items-center justify-center text-blue-400 mb-3 animate-pulse">
          <Wallet className="w-5 h-5 text-blue-400" />
        </div>
        <p className="text-xs">Loading HisabFlow...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const getPageTitle = (tab: NavTab): string => {
    switch (tab) {
      case 'admin-dashboard':
        return 'System Dashboard';
      case 'admin-users':
        return 'User Management';
      case 'admin-logs':
        return 'Audit Logs';
      case 'admin-settings':
        return 'System Settings';
      case 'dashboard':
        return 'Dashboard';
      case 'accounts':
        return 'Accounts';
      case 'income':
        return 'Income';
      case 'expenses':
        return 'Expenses';
      case 'budgets':
        return 'Budgets';
      case 'transfers':
        return 'Transfers';
      case 'loans':
        return 'Loans';
      case 'categories':
        return 'Categories';
      case 'transactions':
        return 'Transactions';
      case 'reports':
        return 'Reports';
      case 'settings':
        return 'Settings';
      default:
        return 'HisabFlow';
    }
  };

  const title = getPageTitle(currentTab);

  return (
    <div className="min-h-screen bg-[#121417] text-gray-100 flex flex-col antialiased">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-[#1a1d24] border border-[#2b2e37] text-gray-100 rounded p-3 shadow-xl flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-200 leading-snug flex-1">{notification}</p>
          <button
            onClick={() => setNotification(null)}
            className="text-gray-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        overBudgetCount={overBudgetCount}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
          onOpenQuickAction={(action) => setActiveModal(action)}
        />

        <main className="flex-1 p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto w-full">
          {/* System Admin Sections */}
          {isAdmin && (
            <>
              {currentTab === 'admin-dashboard' && (
                <AdminView
                  initialSection="dashboard"
                  onSuccessNotification={showNotification}
                  onNavigateTab={setCurrentTab}
                />
              )}
              {currentTab === 'admin-users' && (
                <AdminView
                  initialSection="users"
                  onSuccessNotification={showNotification}
                  onNavigateTab={setCurrentTab}
                />
              )}
              {currentTab === 'admin-logs' && (
                <AdminView
                  initialSection="logs"
                  onSuccessNotification={showNotification}
                  onNavigateTab={setCurrentTab}
                />
              )}
              {currentTab === 'admin-settings' && (
                <AdminView
                  initialSection="settings"
                  onSuccessNotification={showNotification}
                  onNavigateTab={setCurrentTab}
                />
              )}
            </>
          )}

          {/* Normal User Financial Modules */}
          {!isAdmin && (
            <>
              {currentTab === 'dashboard' && (
                <DashboardView
                  onOpenQuickAction={(action) => setActiveModal(action)}
                  onNavigateTab={(tab) => setCurrentTab(tab)}
                  selectedPeriod={selectedPeriod}
                />
              )}

              {currentTab === 'accounts' && (
                <AccountsView
                  onOpenTransferModal={() => setActiveModal('transfer')}
                  onNavigateTab={(tab) => setCurrentTab(tab)}
                  onSuccessNotification={showNotification}
                />
              )}

              {currentTab === 'income' && (
                <IncomeView
                  onOpenAddIncomeModal={() => setActiveModal('income')}
                  onSuccessNotification={showNotification}
                />
              )}

              {currentTab === 'expenses' && (
                <ExpensesView
                  onOpenSingleExpenseModal={() => setActiveModal('expense')}
                  onSuccessNotification={showNotification}
                />
              )}

              {currentTab === 'budgets' && (
                <BudgetsView
                  onSuccessNotification={showNotification}
                  onNavigateTab={(tab) => setCurrentTab(tab)}
                />
              )}

              {currentTab === 'transfers' && (
                <TransfersView
                  onOpenTransferModal={() => setActiveModal('transfer')}
                  onSuccessNotification={showNotification}
                />
              )}

              {currentTab === 'loans' && (
                <LoansView
                  onOpenAddLoanModal={() => setActiveModal('loan')}
                  onOpenRepaymentModal={(loan) => {
                    setSelectedLoanForRepayment(loan);
                    setActiveModal('repayment');
                  }}
                  onSuccessNotification={showNotification}
                />
              )}

              {currentTab === 'categories' && (
                <CategoriesView onSuccessNotification={showNotification} />
              )}

              {currentTab === 'transactions' && <TransactionsView />}

              {currentTab === 'reports' && <ReportsView />}

              {currentTab === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>

      {/* Global Quick Action Modals (only active for user role) */}
      {!isAdmin && (
        <ActionModals
          activeModal={activeModal}
          onClose={() => {
            setActiveModal(null);
            setSelectedLoanForRepayment(null);
          }}
          selectedLoanForRepayment={selectedLoanForRepayment}
          onSuccessNotification={showNotification}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <AppContent />
      </FinanceProvider>
    </AuthProvider>
  );
}
