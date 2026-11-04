import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../constants/theme';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME, APP_VERSION } from '../../constants/config';

export const MoreScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [logoutVisible, setLogoutVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Header title="More" showDateFilter={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Profile Card */}
        <TouchableOpacity
          style={styles.userCard}
          activeOpacity={0.7}
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
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Financial Tools Section */}
        <Text style={styles.sectionHeading}>Financial Operations</Text>
        <Card style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Projects')}
          >
            <View style={styles.menuLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="briefcase-outline" size={18} color={COLORS.textSecondary} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Projects</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('CategoriesScreen')}
          >
            <View style={styles.menuLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="pricetags-outline" size={18} color={COLORS.textSecondary} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Categories</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('LoansScreen')}
          >
            <View style={styles.menuLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="cash-outline" size={18} color={COLORS.textSecondary} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Lending & Borrowing</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('TransfersScreen')}
          >
            <View style={styles.menuLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="swap-horizontal" size={18} color={COLORS.textSecondary} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Account Transfers</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('BudgetsScreen')}
          >
            <View style={styles.menuLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="pie-chart-outline" size={18} color={COLORS.textSecondary} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Monthly Budgets</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Preferences & Security */}
        <Text style={styles.sectionHeading}>Preferences & Security</Text>
        <Card style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.menuLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} />
              </View>
              <View>
                <Text style={styles.menuTitle}>Profile & Preferences</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={() => setLogoutVisible(true)}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.dangerLight }]}>
                <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
              </View>
              <View>
                <Text style={[styles.menuTitle, { color: COLORS.danger }]}>Sign Out</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </Card>

        {/* Footer info */}
        <View style={styles.appFooter}>
          <Text style={styles.footerText}>{APP_NAME} v{APP_VERSION}</Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={logoutVisible}
        title="Sign Out"
        message="Are you sure you want to sign out? Your credentials and session will be securely cleared."
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
    paddingBottom: SPACING.xxl,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceGhost,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
    marginBottom: SPACING.lg,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    color: '#FFF',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  userEmail: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
  userRole: {
    color: COLORS.primary,
    fontSize: FONT_SIZE.xs - 2,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  sectionHeading: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  menuCard: {
    backgroundColor: COLORS.surfaceGhost,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderHairline,
    padding: 0,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderHairline,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    backgroundColor: COLORS.surfaceElevated,
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  appFooter: {
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
});
