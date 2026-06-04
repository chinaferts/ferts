import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth, User, UserRole } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

// 用户统计信息组件
function UserStats({ users }: { users: User[] }) {
  const adminCount = useMemo(() => users.filter(u => u.role === 'admin').length, [users]);
  const inspectorCount = useMemo(() => users.filter(u => u.role === 'inspector').length, [users]);

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{users.length}</Text>
        <Text style={styles.statLabel}>总用户</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statNumber, { color: '#4F46E5' }]}>{adminCount}</Text>
        <Text style={styles.statLabel}>管理员</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statNumber, { color: '#059669' }]}>{inspectorCount}</Text>
        <Text style={styles.statLabel}>验货员</Text>
      </View>
    </View>
  );
}

// 空状态组件
function EmptyState() {
  const { t } = useLanguage();
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Feather name="user" size={48} color="#B2BEC3" />
      </View>
      <Text style={styles.emptyTitle}>{t('noUsers')}</Text>
      <Text style={styles.emptySubtitle}>{t('clickToAddUser')}</Text>
    </View>
  );
}

interface UserItemProps {
  user: User;
  isCurrentUser: boolean;
  isAdmin: boolean;
  onRoleChange: (userId: string, newRole: UserRole) => void;
  onDelete: (userId: string, userName: string) => void;
  onEdit: (user: User) => void;
}

function UserItem({ user, isCurrentUser, isAdmin, onRoleChange, onDelete, onEdit }: UserItemProps) {
  const getRoleBadge = (role: UserRole) => {
    if (role === 'admin') {
      return { text: '管理员', bg: '#EEF2FF', color: '#4F46E5' };
    }
    return { text: '验货员', bg: '#ECFDF5', color: '#059669' };
  };
  const badge = getRoleBadge(user.role);

  const handleRoleToggle = () => {
    if (isCurrentUser) {
      Alert.alert('提示', '不能修改自己的角色');
      return;
    }
    const newRole = user.role === 'admin' ? 'inspector' : 'admin';
    Alert.alert(
      '确认修改',
      `确定将 ${user.name} 的角色修改为 ${newRole === 'admin' ? '管理员' : '验货员'} 吗？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '确定', onPress: () => onRoleChange(user.id, newRole) },
      ]
    );
  };

  return (
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
        <View style={[styles.avatar, user.role === 'admin' && styles.avatarAdmin]}>
          <Text style={[styles.avatarText, user.role === 'admin' && styles.avatarTextAdmin]}>
            {user.name[0]}
          </Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>
            {user.name}
            {isCurrentUser && <Text style={styles.currentBadge}> (本人)</Text>}
          </Text>
          <View style={styles.userMetaRow}>
            <Text style={styles.userMeta}>@{user.username}</Text>
            {user.phone && <Text style={styles.userPhone}>{user.phone}</Text>}
          </View>
          {isAdmin && user.password && (
            <Text style={styles.passwordText}>密码: {user.password}</Text>
          )}
        </View>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.roleBadge, { backgroundColor: badge.bg }]}
          onPress={handleRoleToggle}
          disabled={isCurrentUser}
        >
          <Text style={[styles.roleText, { color: badge.color }]}>{badge.text}</Text>
          {!isCurrentUser && <Text style={styles.arrow}>›</Text>}
        </TouchableOpacity>
        {isAdmin && !isCurrentUser && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => onEdit(user)}
            >
              <Text style={styles.editText}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => onDelete(user.id, user.name)}
            >
              <Text style={styles.deleteText}>删除</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default function AccountScreen() {
  const { user: currentUser, isAdmin, updateUser } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', password: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'inspector'>('all');

  const fetchUsers = useCallback(async () => {
    try {
      // 管理员获取包含密码的用户列表
      const endpoint = isAdmin 
        ? `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/all-with-password`
        : `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users`;
      const headers: HeadersInit = {};
      if (isAdmin) {
        headers['x-user-role'] = 'admin';
      }
      const response = await fetch(endpoint, { headers });
      if (response.ok) {
        const result = await response.json();
        const list = result.data || result || [];
        setUsers(list.map((u: any) => ({
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          password: u.password,
          phone: u.phone,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers])
  );

  // 过滤后的用户列表
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // 搜索过滤
      const matchKeyword = !searchKeyword || 
        user.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        user.username.toLowerCase().includes(searchKeyword.toLowerCase());
      // 角色过滤
      const matchRole = filterRole === 'all' || user.role === filterRole;
      return matchKeyword && matchRole;
    });
  }, [users, searchKeyword, filterRole]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => u.id === userId ? updatedUser : u));
        if (userId === currentUser?.id) {
          updateUser(updatedUser);
        }
        Alert.alert('成功', '角色已更新');
      } else {
        Alert.alert('错误', '更新失败');
      }
    } catch (error) {
      Alert.alert('错误', '网络错误');
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      Alert.alert('提示', '不能删除自己的账号');
      return;
    }
    Alert.alert(
      '确认删除',
      `确定要删除用户 "${userName}" 吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => doDeleteUser(userId) },
      ]
    );
  };

  const doDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/${userId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setUsers(users.filter(u => u.id !== userId));
        Alert.alert('成功', '用户已删除');
      } else {
        Alert.alert('错误', '删除失败');
      }
    } catch (error) {
      Alert.alert('错误', '网络错误');
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setEditForm({ name: '', phone: '', password: '' });
    setEditModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({ name: user.name, phone: user.phone || '', password: user.password || '' });
    setEditModalVisible(true);
  };

  const handleSaveUser = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('错误', '请输入姓名');
      return;
    }
    // 新建用户时必须设置密码
    if (!editingUser && !editForm.password.trim()) {
      Alert.alert('错误', '请设置密码');
      return;
    }

    setIsSaving(true);
    try {
      // 构建请求数据，只包含非空字段
      const requestData: any = { name: editForm.name };
      if (editForm.phone.trim()) {
        requestData.phone = editForm.phone;
      }
      if (editForm.password.trim()) {
        requestData.password = editForm.password;
      }
      
      if (editingUser) {
        // 更新用户
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        });
        if (response.ok) {
          const updatedUser = await response.json();
          setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
          if (editingUser.id === currentUser?.id) {
            updateUser(updatedUser);
          }
          setEditModalVisible(false);
          Alert.alert('成功', '用户信息已更新');
        }
      } else {
        // 创建新用户
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        });
        if (response.ok) {
          const newUser = await response.json();
          setUsers([...users, newUser]);
          setEditModalVisible(false);
          Alert.alert('成功', '用户已创建');
        }
      }
    } catch (error) {
      Alert.alert('错误', '操作失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.lockIcon}>
            <Feather name="lock" size={48} color="#B2BEC3" />
          </View>
          <Text style={styles.noPermissionTitle}>{t('noPermission')}</Text>
          <Text style={styles.noPermissionText}>{t('adminOnlyAccess')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{currentUser?.name?.[0] || 'U'}</Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName}>{currentUser?.name}</Text>
            <Text style={styles.headerRole}>
              {currentUser?.role === 'admin' ? '管理员' : '验货员'}
            </Text>
          </View>
        </View>
        <UserStats users={users} />
      </View>

      {/* User List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>账号管理</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddUser}>
            <Text style={styles.addButtonText}>+ 添加用户</Text>
          </TouchableOpacity>
        </View>

        {/* 搜索和筛选 */}
        <View style={styles.filterContainer}>
          <View style={styles.searchContainer}>
            <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIconFeather} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('searchUser')}
              placeholderTextColor="#9CA3AF"
              value={searchKeyword}
              onChangeText={setSearchKeyword}
            />
            {searchKeyword.length > 0 && (
              <TouchableOpacity onPress={() => setSearchKeyword('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filterTabs}>
            {[
              { key: 'all', label: '全部' },
              { key: 'admin', label: '管理员' },
              { key: 'inspector', label: '验货员' },
            ].map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterTab,
                  filterRole === tab.key && styles.filterTabActive,
                ]}
                onPress={() => setFilterRole(tab.key as 'all' | 'admin' | 'inspector')}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterRole === tab.key && styles.filterTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loader} color="#4F46E5" />
        ) : filteredUsers.length === 0 ? (
          searchKeyword || filterRole !== 'all' ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>未找到匹配用户</Text>
              <Text style={styles.emptySubtitle}>尝试调整搜索条件</Text>
            </View>
          ) : (
            <EmptyState />
          )
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <UserItem
                user={item}
                isCurrentUser={item.id === currentUser?.id}
                isAdmin={currentUser?.role === 'admin'}
                onRoleChange={handleRoleChange}
                onDelete={handleDeleteUser}
                onEdit={handleEditUser}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Edit Modal */}
      <Modal visible={isEditModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingUser ? '编辑用户' : '添加用户'}
            </Text>
            <View style={styles.modalForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>姓名</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="请输入姓名"
                  value={editForm.name}
                  onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                />
              </View>
              {isAdmin && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>密码 {editingUser ? '（留空则不修改）' : ''}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={editingUser ? '输入新密码（选填）' : '请设置密码'}
                    value={editForm.password}
                    onChangeText={(text) => setEditForm({ ...editForm, password: text })}
                    secureTextEntry
                  />
                </View>
              )}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>电话</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="请输入电话（选填）"
                  value={editForm.phone}
                  onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveUser}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>保存</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockIconText: {
    fontSize: 36,
  },
  noPermissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  noPermissionText: {
    fontSize: 16,
    color: '#6B7280',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerRole: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  section: {
    flex: 1,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchIconFeather: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    padding: 0,
  },
  clearIcon: {
    fontSize: 14,
    color: '#9CA3AF',
    padding: 4,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#4F46E5',
  },
  filterTabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarAdmin: {
    backgroundColor: '#EEF2FF',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6B7280',
  },
  avatarTextAdmin: {
    color: '#4F46E5',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  currentBadge: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: 'normal',
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userMeta: {
    fontSize: 14,
    color: '#6B7280',
  },
  userPhone: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  passwordText: {
    fontSize: 13,
    color: '#F59E0B',
    marginTop: 4,
    fontWeight: '500',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  arrow: {
    fontSize: 16,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  loader: {
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalForm: {
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4F46E5',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 6,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  editButton: {
    backgroundColor: '#DBEAFE',
  },
});
