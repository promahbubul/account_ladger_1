import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME, APP_VERSION } from '../../constants/config';

export const SettingsScreen = ({ navigation }) => {
  const { user, logout, isAdmin } = useAuth();
  const [logoutVisible, setLogoutVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Header title="Settings" showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <TouchableOpacity
          style={styles.userCard}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.fullName || user?.username || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.fullName || user?.username || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userRole}>ROLE: {user?.role || 'USER'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Financial Settings Section */}
        <Text style={styles.sectionHeading}>Financial Management</Text>
        <Card style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('CategoriesScreen')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="pricetags-outline" size={20} color={COLORS.primary} />
              <Text style={styles.menuText}>Categories & Subcategories</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('BudgetsScreen')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="pie-chart-outline" size={20} color={COLORS.warning} />
              <Text style={styles.menuText}>Monthly Budgets</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('TransfersScreen')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="swap-horizontal" size={20} color={COLORS.success} />
              <Text style={styles.menuText}>Transfer History</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* System Administration Section (Admins Only) */}
        {isAdmin ? (
          <>
            <Text style={styles.sectionHeading}>System Administration</Text>
            <Card style={styles.menuCard}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('AdminDashboard')}
              >
                <View style={styles.menuLeft}>
                  <Ionicons name="speedometer-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.menuText}>System Dashboard</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('AdminUsers')}
              >
                <View style={styles.menuLeft}>
                  <Ionicons name="people-outline" size={20} color={COLORS.purple} />
                  <Text style={styles.menuText}>User Management</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigation.navigate('AdminLogs')}
              >
                <View style={styles.menuLeft}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.warning} />
                  <Text style={styles.menuText}>Audit Logs</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </Card>
          </>
        ) : null}

        {/* Account & App Info */}
        <Text style={styles.sectionHeading}>Account</Text>
        <Card style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="person-outline" size={20} color={COLORS.text} />
              <Text style={styles.menuText}>Profile & Preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => setLogoutVisible(true)}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
              <Text style={[styles.menuText, { color: COLORS.danger }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </Card>

        <View style={styles.appFooter}>
          <Text style={styles.footerText}>{APP_NAME} v{APP_VERSION}</Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={logoutVisible}
        title="Sign Out"
        message="Are you sure you want to sign out of your account? Your session will be safely cleared."
        confirmText="Sign Out"
        onConfirm={logout}
        onCancel={() => setLogoutVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
    color: COLORS.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  userRole: {
    fontSize: FONT_SIZE.xs - 2,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  appFooter: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  footerText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
});
