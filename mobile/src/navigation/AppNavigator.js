import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE } from '../constants/theme';

// Screens
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { TransactionsScreen } from '../screens/transactions/TransactionsScreen';
import { TransactionDetailScreen } from '../screens/transactions/TransactionDetailScreen';
import { AccountsScreen } from '../screens/accounts/AccountsScreen';
import { AccountDetailScreen } from '../screens/accounts/AccountDetailScreen';
import { CreateAccountScreen } from '../screens/accounts/CreateAccountScreen';
import { AddIncomeScreen } from '../screens/income/AddIncomeScreen';
import { IncomeScreen } from '../screens/income/IncomeScreen';
import { AddExpenseScreen } from '../screens/expenses/AddExpenseScreen';
import { ExpensesScreen } from '../screens/expenses/ExpensesScreen';
import { BulkExpenseScreen } from '../screens/expenses/BulkExpenseScreen';
import { TransfersScreen } from '../screens/transfers/TransfersScreen';
import { CreateTransferScreen } from '../screens/transfers/CreateTransferScreen';
import { LoansScreen } from '../screens/lending/LoansScreen';
import { CreateLoanScreen } from '../screens/lending/CreateLoanScreen';
import { AddRepaymentScreen } from '../screens/lending/AddRepaymentScreen';
import { CategoriesScreen } from '../screens/categories/CategoriesScreen';
import { CreateCategoryScreen } from '../screens/categories/CreateCategoryScreen';
import { BudgetsScreen } from '../screens/settings/BudgetsScreen';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontSize: FONT_SIZE.xs - 2,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;
          if (route.name === 'DashboardTab') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'TransactionsTab') iconName = focused ? 'receipt' : 'receipt-outline';
          else if (route.name === 'AccountsTab') iconName = focused ? 'wallet' : 'wallet-outline';
          else if (route.name === 'LoansTab') iconName = focused ? 'cash' : 'cash-outline';
          else if (route.name === 'ReportsTab') iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          else if (route.name === 'SettingsTab') iconName = focused ? 'settings' : 'settings-outline';

          return <Ionicons name={iconName} size={20} color={color} />;
        },
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="TransactionsTab" component={TransactionsScreen} options={{ tabBarLabel: 'Ledger' }} />
      <Tab.Screen name="AccountsTab" component={AccountsScreen} options={{ tabBarLabel: 'Accounts' }} />
      <Tab.Screen name="LoansTab" component={LoansScreen} options={{ tabBarLabel: 'Loans' }} />
      <Tab.Screen name="ReportsTab" component={ReportsScreen} options={{ tabBarLabel: 'Reports' }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="AddIncome" component={AddIncomeScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
      <Stack.Screen name="BulkExpense" component={BulkExpenseScreen} />
      <Stack.Screen name="CreateTransfer" component={CreateTransferScreen} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
      <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} />
      <Stack.Screen name="CreateLoan" component={CreateLoanScreen} />
      <Stack.Screen name="AddRepayment" component={AddRepaymentScreen} />
      <Stack.Screen name="CategoriesScreen" component={CategoriesScreen} />
      <Stack.Screen name="CreateCategory" component={CreateCategoryScreen} />
      <Stack.Screen name="BudgetsScreen" component={BudgetsScreen} />
      <Stack.Screen name="TransfersScreen" component={TransfersScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
};
