import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Tags,
  HandCoins,
  ReceiptText,
  BarChart3,
  Settings,
  ShieldAlert,
  Sliders,
  Users,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab = 
  // User modules
  | 'dashboard'
  | 'accounts'
  | 'income'
  | 'expenses'
  | 'budgets'
  | 'transfers'
  | 'loans'
  | 'categories'
  | 'transactions'
  | 'reports'
  | 'settings'
  // Admin modules
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-logs'
  | 'admin-settings';

interface SidebarProps {
  currentTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  overBudgetCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isMobileOpen,
  setIsMobileOpen,
  overBudgetCount = 0,
}) => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const pathname = usePathname();

  // Strict separation: System Admin only sees administrative navigation items
  const adminNavItems = [
    { id: 'admin-dashboard' as NavTab, href: '/admin', label: 'System Dashboard', icon: LayoutDashboard },
    { id: 'admin-users' as NavTab, href: '/admin/users', label: 'User Management', icon: Users },
    { id: 'admin-logs' as NavTab, href: '/admin/logs', label: 'Audit Logs', icon: ShieldAlert },
    { id: 'admin-settings' as NavTab, href: '/admin/settings', label: 'System Settings', icon: Sliders },
  ];

  // Normal Users only see personal financial modules
  const userNavItems = [
    { id: 'dashboard' as NavTab, href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'accounts' as NavTab, href: '/accounts', label: 'Accounts', icon: Wallet },
    { id: 'income' as NavTab, href: '/income', label: 'Income', icon: ArrowDownLeft },
    { id: 'expenses' as NavTab, href: '/expenses', label: 'Expenses', icon: ArrowUpRight },
    {
      id: 'budgets' as NavTab,
      href: '/budgets',
      label: 'Budgets',
      icon: BarChart3,
      alertBadge: overBudgetCount > 0 ? `${overBudgetCount}` : undefined,
    },
    { id: 'transfers' as NavTab, href: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
    { id: 'loans' as NavTab, href: '/loans', label: 'Loans', icon: HandCoins },
    { id: 'categories' as NavTab, href: '/categories', label: 'Categories', icon: Tags },
    { id: 'transactions' as NavTab, href: '/transactions', label: 'Transactions', icon: ReceiptText },
    { id: 'reports' as NavTab, href: '/reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings' as NavTab, href: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (tab: NavTab) => {
    if (onSelectTab) onSelectTab(tab);
    setIsMobileOpen(false);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#0d0f12] border-r border-[#22252c] flex flex-col transition-transform duration-150 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#22252c]">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Account Ladger Logo"
              className="w-7 h-7 object-contain"
            />
            <div>
              <span className="font-semibold text-sm tracking-tight text-gray-100">Account Ladger</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#181a20] text-gray-300 border border-[#2b2e37]">
            {isAdmin ? 'ADMIN' : (user?.currency || 'BDT')}
          </span>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {isAdmin ? (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-purple-400">
                System Administration
              </div>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href === '/admin' && (pathname === '/admin' || pathname === '/admin/dashboard'));
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                      isActive
                        ? 'bg-[#1e1b2e] text-purple-400 font-medium border-l-2 border-purple-500'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#14161c]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                Accounting Modules
              </div>
              {userNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href === '/dashboard' && (pathname === '/' || pathname === '/dashboard'));

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                      isActive
                        ? 'bg-[#181b22] text-blue-400 font-medium border-l-2 border-blue-500'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#14161c]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 ${
                          isActive ? 'text-blue-400' : 'text-gray-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.alertBadge && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/80">
                        {item.alertBadge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* User profile footer */}
        <div className="p-3 border-t border-[#22252c] bg-[#0a0c0e]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded bg-[#20232b] border border-[#2b2e37] flex items-center justify-center text-xs font-medium text-gray-300 flex-shrink-0">
                {getInitials(user?.fullName || user?.username)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-gray-200 truncate">{user?.fullName || user?.username}</p>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${
                      isAdmin
                        ? 'bg-purple-950 text-purple-300 border-purple-800'
                        : 'bg-gray-800 text-gray-300 border-gray-700'
                    }`}
                  >
                    {isAdmin ? 'ADMIN' : 'USER'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#181a20] rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
