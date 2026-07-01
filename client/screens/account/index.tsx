import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
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
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';
import { useAuth, User, UserRole } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getApiBaseUrl } from '@/utils/api';

const API_BASE = getApiBaseUrl();

// 用户统计信息组件
function UserStats({ users }: { users: User[] }) {
  const { t } = useLanguage();
  const adminCount = useMemo(() => users.filter(u => u.role === 'admin').length, [users]);
  const inspectorCount = useMemo(() => users.filter(u => u.role === 'inspector').length, [users]);

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{users.length}</Text>
        <Text style={styles.statLabel}>{t('totalUsers')} / {t('totalUsersEn')}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statNumber, { color: '#4F46E5' }]}>{adminCount}</Text>
        <Text style={styles.statLabel}>{t('admin')} / {t('adminEn')}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statNumber, { color: '#059669' }]}>{inspectorCount}</Text>
        <Text style={styles.statLabel}>{t('inspector')} / {t('inspectorEn')}</Text>
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
  const { t } = useLanguage();
  
  const getRoleBadge = (role: UserRole) => {
    if (role === 'admin') {
      return { text: `${t('admin')} / ${t('adminEn')}`, bg: '#EEF2FF', color: '#4F46E5' };
    }
    return { text: `${t('inspector')} / ${t('inspectorEn')}`, bg: '#ECFDF5', color: '#059669' };
  };
  const badge = getRoleBadge(user.role);

  const handleRoleToggle = () => {
    if (isCurrentUser) {
      Alert.alert(t('tip'), t('cannotChangeOwnRole'));
      return;
    }
    const newRole = user.role === 'admin' ? 'inspector' : 'admin';
    const newRoleText = newRole === 'admin' ? `${t('admin')} / ${t('adminEn')}` : `${t('inspector')} / ${t('inspectorEn')}`;
    Alert.alert(
      t('confirmChange'),
      `${t('confirmChangeRole')} ${user.name} → ${newRoleText}`,
      [
        { text: `${t('cancel')} / ${t('cancelEn')}`, style: 'cancel' },
        { text: `${t('confirm')} / ${t('confirmEn')}`, onPress: () => onRoleChange(user.id, newRole) },
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
            {isCurrentUser && <Text style={styles.currentBadge}> ({t('currentUser')} / {t('currentUserEn')})</Text>}
          </Text>
          <Text style={styles.userMeta}>@{user.username}</Text>
        </View>
      </View>
      <View style={styles.userActions}>
        {isAdmin && !isCurrentUser && (
          <>
            <TouchableOpacity
              style={[styles.roleBadge, { backgroundColor: badge.bg }]}
              onPress={handleRoleToggle}
            >
              <Text style={[styles.roleText, { color: badge.color }]}>{badge.text}</Text>
            </TouchableOpacity>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => onEdit(user)}
              >
                <Feather name="edit-2" size={14} color="#4F46E5" />
                <Text style={styles.editText}>{t('edit')} / {t('editEn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => onDelete(user.id, user.name)}
              >
                <Feather name="trash-2" size={14} color="#EF4444" />
                <Text style={styles.deleteText}>{t('delete')} / {t('deleteEn')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {isCurrentUser && (
          <TouchableOpacity
            style={[styles.roleBadge, { backgroundColor: badge.bg }]}
          >
            <Text style={[styles.roleText, { color: badge.color }]}>{badge.text}</Text>
          </TouchableOpacity>
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
  const [editForm, setEditForm] = useState({ name: '', phone: '', password: '', role: 'inspector' as UserRole });
  const [isSaving, setIsSaving] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'inspector'>('all');

  const fetchUsers = useCallback(async () => {
    try {
      // 管理员获取包含密码的用户列表
      const endpoint = isAdmin 
        ? `${API_BASE}/api/v1/users/all-with-password`
        : `${API_BASE}/api/v1/users`;
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
      const response = await fetch(`${API_BASE}/api/v1/users/${userId}/role`, {
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
        Alert.alert(`${t('success')} / ${t('successEn')}`, `${t('roleUpdated')} / ${t('roleUpdatedEn')}`);
      } else {
        Alert.alert(`${t('error')} / ${t('errorEn')}`, `${t('updateFailed')} / ${t('updateFailedEn')}`);
      }
    } catch (error) {
      Alert.alert(`${t('error')} / ${t('errorEn')}`, `${t('networkError')} / ${t('networkErrorEn')}`);
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      Alert.alert(`${t('tip')} / ${t('tipEn')}`, `${t('cannotDeleteOwn')} / ${t('cannotDeleteOwnEn')}`);
      return;
    }
    Alert.alert(
      `${t('confirmDelete')} / ${t('confirmDeleteEn')}`,
      `${t('confirmDeleteUser')} "${userName}"？${t('cannotUndo')} / ${t('cannotUndoEn')}`,
      [
        { text: `${t('cancel')} / ${t('cancelEn')}`, style: 'cancel' },
        { text: `${t('delete')} / ${t('deleteEn')}`, style: 'destructive', onPress: () => doDeleteUser(userId) },
      ]
    );
  };

  const doDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/users/${userId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setUsers(users.filter(u => u.id !== userId));
        Alert.alert(`${t('success')} / ${t('successEn')}`, `${t('userDeleted')} / ${t('userDeletedEn')}`);
      } else {
        Alert.alert(`${t('error')} / ${t('errorEn')}`, `${t('deleteFailed')} / ${t('deleteFailedEn')}`);
      }
    } catch (error) {
      Alert.alert(`${t('error')} / ${t('errorEn')}`, `${t('networkError')} / ${t('networkErrorEn')}`);
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setEditForm({ name: '', phone: '', password: '', role: 'inspector' });
    setEditModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({ name: user.name, phone: user.phone || '', password: user.password || '', role: user.role });
    setEditModalVisible(true);
  };

  const handleSaveUser = async () => {
    if (!editForm.name.trim()) {
      Alert.alert(`${t('error')} / ${t('errorEn')}`, `${t('enterNameRequired')} / ${t('enterNameRequiredEn')}`);
      return;
    }
    // 新建用户时必须设置密码
    if (!editingUser && !editForm.password.trim()) {
      Alert.alert(`${t('error')} / ${t('errorEn')}`, `${t('enterPwdRequired')} / ${t('enterPwdRequiredEn')}`);
      return;
    }

    setIsSaving(true);
    try {
      // 构建请求数据，只包含非空字段
      const requestData: any = { name: editForm.name, role: editForm.role };
      if (editForm.phone.trim()) {
        requestData.phone = editForm.phone;
      }
      if (editForm.password.trim()) {
        requestData.password = editForm.password;
      }
      
      if (editingUser) {
        // 更新用户
        const response = await fetch(`${API_BASE}/api/v1/users/${editingUser.id}`, {
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
          Alert.alert(`${t('success')} / ${t('successEn')}`, `${t('userUpdated')} / ${t('userUpdatedEn')}`);
        }
      } else {
        // 创建新用户
        const response = await fetch(`${API_BASE}/api/v1/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        });
        if (response.ok) {
          const newUser = await response.json();
          setUsers([...users, newUser]);
          setEditModalVisible(false);
          Alert.alert(
            `${t('success')} / ${t('successEn')}`,
            `${t('userCreated')} / ${t('userCreatedEn')}\n${t('username')}: ${newUser.username}\n${t('password')}: ${editForm.password}`
          );
        }
      }
    } catch (error) {
      Alert.alert(`${t('error')} / ${t('errorEn')}`, `${t('operationFailed')} / ${t('operationFailedEn')}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <Screen>
        <View style={styles.centerContent}>
          <View style={styles.lockIcon}>
            <Feather name="lock" size={48} color="#B2BEC3" />
          </View>
          <Text style={styles.noPermissionTitle}>{t('noPermission')}</Text>
          <Text style={styles.noPermissionText}>{t('adminOnlyAccess')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{currentUser?.name?.[0] || 'U'}</Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName}>{currentUser?.name}</Text>
            <Text style={styles.headerRole}>
              {currentUser?.role === 'admin' ? `${t('admin')} / ${t('adminEn')}` : `${t('inspector')} / ${t('inspectorEn')}`}
            </Text>
          </View>
        </View>
        <UserStats users={users} />
      </View>

      {/* User List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('accountManagement')} / {t('accountManagementEn')}</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddUser}>
            <Text style={styles.addButtonText}>+ {t('addUser')} / {t('addUserEn')}</Text>
          </TouchableOpacity>
        </View>

        {/* 搜索和筛选 */}
        <View style={styles.filterContainer}>
          <View style={styles.searchContainer}>
            <Feather name="search" size={20} color="#9CA3AF" style={styles.searchIconFeather} />
            <TextInput
              style={styles.searchInput}
              placeholder={`${t('searchUser')} / ${t('searchUserEn')}`}
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
            <TouchableOpacity
              key="all"
              style={[
                styles.filterTab,
                filterRole === 'all' && styles.filterTabActive,
              ]}
              onPress={() => setFilterRole('all')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterRole === 'all' && styles.filterTabTextActive,
                ]}
              >
                {t('all')} / {t('allEn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              key="admin"
              style={[
                styles.filterTab,
                filterRole === 'admin' && styles.filterTabActive,
              ]}
              onPress={() => setFilterRole('admin')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterRole === 'admin' && styles.filterTabTextActive,
                ]}
              >
                {t('admin')} / {t('adminEn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              key="inspector"
              style={[
                styles.filterTab,
                filterRole === 'inspector' && styles.filterTabActive,
              ]}
              onPress={() => setFilterRole('inspector')}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterRole === 'inspector' && styles.filterTabTextActive,
                ]}
              >
                {t('inspector')} / {t('inspectorEn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loader} color="#4F46E5" />
        ) : filteredUsers.length === 0 ? (
          searchKeyword || filterRole !== 'all' ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>{t('noMatchFound')} / {t('noMatchFoundEn')}</Text>
              <Text style={styles.emptySubtitle}>{t('tryAdjust')} / {t('tryAdjustEn')}</Text>
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
              {editingUser ? `${t('editUser')} / ${t('editUserEn')}` : `${t('addUser')} / ${t('addUserEn')}`}
            </Text>
            <View style={styles.modalForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('name')} / {t('nameEn')}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={`${t('enterName')} / ${t('enterNameEn')}`}
                  value={editForm.name}
                  onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                />
              </View>
              {isAdmin && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('password')} / {t('passwordEn')} {editingUser ? `(${t('optional')} / ${t('optionalEn')})` : ''}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={editingUser ? `${t('enterNewPwd')} / ${t('enterNewPwdEn')}` : `${t('setPwd')} / ${t('setPwdEn')}`}
                    value={editForm.password}
                    onChangeText={(text) => setEditForm({ ...editForm, password: text })}
                    secureTextEntry
                  />
                </View>
              )}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('phone')} / {t('phoneEn')}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={`${t('enterPhone')} / ${t('enterPhoneEn')}`}
                  value={editForm.phone}
                  onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                  keyboardType="phone-pad"
                />
              </View>
              {isAdmin && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('role')} / {t('roleEn')}</Text>
                  <View style={styles.roleSelector}>
                    <TouchableOpacity
                      style={[styles.roleButton, editForm.role === 'admin' && styles.roleButtonActive]}
                      onPress={() => setEditForm({ ...editForm, role: 'admin' })}
                    >
                      <Feather
                        name={editForm.role === 'admin' ? 'check-circle' : 'circle'}
                        size={18}
                        color={editForm.role === 'admin' ? '#4F46E5' : '#9CA3AF'}
                      />
                      <Text style={[styles.roleButtonText, editForm.role === 'admin' && styles.roleButtonTextActive]}>
                        {t('admin')} / {t('adminEn')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleButton, editForm.role === 'inspector' && styles.roleButtonActive]}
                      onPress={() => setEditForm({ ...editForm, role: 'inspector' })}
                    >
                      <Feather
                        name={editForm.role === 'inspector' ? 'check-circle' : 'circle'}
                        size={18}
                        color={editForm.role === 'inspector' ? '#4F46E5' : '#9CA3AF'}
                      />
                      <Text style={[styles.roleButtonText, editForm.role === 'inspector' && styles.roleButtonTextActive]}>
                        {t('inspector')} / {t('inspectorEn')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')} / {t('cancelEn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveUser}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>{t('save')} / {t('saveEn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
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
    gap: 4,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
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
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  roleButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  roleButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  roleButtonTextActive: {
    color: '#4F46E5',
    fontWeight: '600',
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
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  editButton: {
    backgroundColor: '#DBEAFE',
  },
});
