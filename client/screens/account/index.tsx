import { useState, useCallback } from 'react';
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
import { useAuth, User, UserRole } from '@/contexts/AuthContext';

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

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

  const handleDelete = () => {
    if (isCurrentUser) {
      Alert.alert('提示', '不能删除自己的账号');
      return;
    }
    Alert.alert(
      '确认删除',
      `确定要删除用户 "${user.name}" 吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => onDelete(user.id, user.name) },
      ]
    );
  };

  return (
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name[0]}</Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>
            {user.name}
            {isCurrentUser && <Text style={styles.currentBadge}> (本人)</Text>}
          </Text>
          <Text style={styles.userMeta}>@{user.username}</Text>
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
          <>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => onEdit(user)}
            >
              <Text style={styles.editText}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Text style={styles.deleteText}>删除</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

export default function AccountScreen() {
  const { user: currentUser, isAdmin, updateUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users`);
      if (response.ok) {
        const result = await response.json();
        const list = result.data || result || [];
        setUsers(list.map((u: any) => ({
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          phone: u.phone,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers])
  );

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

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/${userId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setUsers(users.filter(u => u.id !== userId));
        Alert.alert('成功', `用户 "${userName}" 已删除`);
      } else {
        Alert.alert('错误', '删除失败');
      }
    } catch (error) {
      Alert.alert('错误', '网络错误');
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setEditForm({ name: '', phone: '' });
    setEditModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({ name: user.name, phone: user.phone || '' });
    setEditModalVisible(true);
  };

  const handleSaveUser = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('错误', '请输入姓名');
      return;
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        // 更新用户
        const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
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
          body: JSON.stringify(editForm),
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
          <Text style={styles.noPermissionText}>仅管理员可访问此页面</Text>
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
          <View>
            <Text style={styles.headerName}>{currentUser?.name}</Text>
            <Text style={styles.headerRole}>
              {currentUser?.role === 'admin' ? '管理员' : '验货员'}
            </Text>
          </View>
        </View>
      </View>

      {/* User List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>账号管理</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddUser}>
            <Text style={styles.addButtonText}>+ 添加用户</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.loader} color="#4F46E5" />
        ) : (
          <FlatList
            data={users}
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
  noPermissionText: {
    fontSize: 16,
    color: '#6B7280',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerRole: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
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
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
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
  userMeta: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
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
    gap: 8,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E0E7FF',
  },
  editButtonText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '500',
  },
});
