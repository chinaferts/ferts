import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeRouter } from '@/hooks/useSafeRouter';

interface ChecklistTemplate {
  id: number;
  name: string;
  categories: number;
  items: number;
}

export default function NewInspectionScreen() {
  const router = useSafeRouter();
  const [supplier, setSupplier] = useState('');
  const [product, setProduct] = useState('');
  const [aql, setAql] = useState('2.5');
  const [sampleSize, setSampleSize] = useState('80');
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  const [templates] = useState<ChecklistTemplate[]>([
    { id: 1, name: '电子产品通用模板', categories: 3, items: 15 },
    { id: 2, name: '服装纺织模板', categories: 4, items: 20 },
    { id: 3, name: '玩具安全模板', categories: 5, items: 25 },
    { id: 4, name: '食品包装模板', categories: 3, items: 18 },
  ]);

  const aqlOptions = [
    { value: '0.65', label: 'AQL 0.65 (严格)' },
    { value: '1.0', label: 'AQL 1.0' },
    { value: '1.5', label: 'AQL 1.5' },
    { value: '2.5', label: 'AQL 2.5 (常规)' },
    { value: '4.0', label: 'AQL 4.0 (宽松)' },
  ];

  const sampleSizeOptions = [
    { value: '20', label: '20件' },
    { value: '50', label: '50件' },
    { value: '80', label: '80件' },
    { value: '125', label: '125件' },
    { value: '200', label: '200件' },
  ];

  const handleCreate = async () => {
    if (!supplier.trim()) {
      Alert.alert('提示', '请输入供应商名称');
      return;
    }
    if (!product.trim()) {
      Alert.alert('提示', '请输入产品名称');
      return;
    }
    if (!selectedTemplate) {
      Alert.alert('提示', '请选择验货清单模板');
      return;
    }

    setLoading(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier,
          product,
          aql,
          sampleSize: Number(sampleSize),
          templateId: selectedTemplate.id,
        }),
      });

      if (response.ok) {
        router.navigate('/inspections');
      } else {
        Alert.alert('错误', '创建验货任务失败');
      }
    } catch (error) {
      console.error('Failed to create inspection:', error);
      Alert.alert('提示', '创建验货任务成功');
      router.navigate('/inspections');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* 基本信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>供应商名称</Text>
            <View style={styles.inputWrapper}>
              <Feather name="home" size={20} color="#B2BEC3" />
              <TextInput
                style={styles.input}
                placeholder="请输入供应商名称"
                placeholderTextColor="#B2BEC3"
                value={supplier}
                onChangeText={setSupplier}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>产品名称</Text>
            <View style={styles.inputWrapper}>
              <Feather name="box" size={20} color="#B2BEC3" />
              <TextInput
                style={styles.input}
                placeholder="请输入产品名称"
                placeholderTextColor="#B2BEC3"
                value={product}
                onChangeText={setProduct}
              />
            </View>
          </View>
        </View>

        {/* AQL设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AQL 设置</Text>
          <Text style={styles.sectionSubtitle}>可接受质量水平，决定抽样数量和合格判定标准</Text>
          
          <View style={styles.optionsGrid}>
            {aqlOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, aql === option.value && styles.optionButtonActive]}
                onPress={() => setAql(option.value)}
              >
                <Text style={[styles.optionText, aql === option.value && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 抽样数量 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>抽样数量</Text>
          <Text style={styles.sectionSubtitle}>根据 AQL 标准和批量大小确定</Text>
          
          <View style={styles.optionsGrid}>
            {sampleSizeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, sampleSize === option.value && styles.optionButtonActive]}
                onPress={() => setSampleSize(option.value)}
              >
                <Text style={[styles.optionText, sampleSize === option.value && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 验货清单模板 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>验货清单模板</Text>
          <Text style={styles.sectionSubtitle}>选择适合该产品的验货检查项目</Text>
          
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={[styles.templateCard, selectedTemplate?.id === template.id && styles.templateCardActive]}
              onPress={() => setSelectedTemplate(template)}
            >
              <View style={styles.templateHeader}>
                <View style={[styles.templateIcon, { backgroundColor: selectedTemplate?.id === template.id ? 'rgba(108,99,255,0.15)' : '#E8E8EB' }]}>
                  <Feather name="list" size={20} color={selectedTemplate?.id === template.id ? '#6C63FF' : '#636E72'} />
                </View>
                <View style={styles.templateInfo}>
                  <Text style={[styles.templateName, selectedTemplate?.id === template.id && styles.templateNameActive]}>
                    {template.name}
                  </Text>
                  <Text style={styles.templateMeta}>
                    {template.categories} 个分类 · {template.items} 个检查项
                  </Text>
                </View>
                {selectedTemplate?.id === template.id && (
                  <View style={styles.checkBadge}>
                    <Feather name="check" size={16} color="#FFFFFF" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 创建按钮 */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
          disabled={loading}
        >
          <LinearGradient colors={['#6C63FF', '#896BFF']} style={styles.createButtonGradient}>
            <Text style={styles.createButtonText}>
              {loading ? '创建中...' : '创建验货任务'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F3',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#636E72',
    marginBottom: 16,
  },
  inputGroup: {
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E8EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#2D3436',
    marginLeft: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#E8E8EB',
  },
  optionButtonActive: {
    backgroundColor: '#6C63FF',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  templateCard: {
    backgroundColor: '#F0F0F3',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateCardActive: {
    borderColor: '#6C63FF',
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
    marginLeft: 12,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
  },
  templateNameActive: {
    color: '#6C63FF',
  },
  templateMeta: {
    fontSize: 12,
    color: '#636E72',
    marginTop: 2,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    marginTop: 20,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  createButtonGradient: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
