import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, FlatList, Keyboard } from 'react-native';
import { Screen } from '@/components/Screen';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeRouter } from '@/hooks/useSafeRouter';

interface ChecklistTemplate {
  id: number;
  name: string;
  categories: number;
  items: number;
}

const STORAGE_KEYS = {
  SUPPLIERS: '@inspection_suppliers',
  PRODUCTS: '@inspection_products',
};

export default function NewInspectionScreen() {
  const router = useSafeRouter();
  const [orderNo, setOrderNo] = useState('');
  const [productNo, setProductNo] = useState('');
  const [supplier, setSupplier] = useState('');
  const [product, setProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [aql, setAql] = useState('2.5');
  const [sampleSize, setSampleSize] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  // 历史记录状态
  const [supplierHistory, setSupplierHistory] = useState<string[]>([]);
  const [productHistory, setProductHistory] = useState<string[]>([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [filteredSuppliers, setFilteredSuppliers] = useState<string[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<string[]>([]);

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    try {
      const suppliersJson = await AsyncStorage.getItem(STORAGE_KEYS.SUPPLIERS);
      const productsJson = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);

      if (suppliersJson) {
        const suppliers = JSON.parse(suppliersJson);
        setSupplierHistory(suppliers);
        setFilteredSuppliers(suppliers);
      }
      if (productsJson) {
        const products = JSON.parse(productsJson);
        setProductHistory(products);
        setFilteredProducts(products);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 保存历史记录
  const saveToHistory = async (type: 'supplier' | 'product', value: string) => {
    if (!value.trim()) return;

    try {
      const key = type === 'supplier' ? STORAGE_KEYS.SUPPLIERS : STORAGE_KEYS.PRODUCTS;
      const history = type === 'supplier' ? [...supplierHistory] : [...productHistory];

      // 如果已存在，先移除
      const index = history.indexOf(value);
      if (index > -1) {
        history.splice(index, 1);
      }

      // 添加到最前面
      history.unshift(value);

      // 只保留最近20条
      const trimmed = history.slice(0, 20);

      await AsyncStorage.setItem(key, JSON.stringify(trimmed));

      if (type === 'supplier') {
        setSupplierHistory(trimmed);
        setFilteredSuppliers(trimmed);
      } else {
        setProductHistory(trimmed);
        setFilteredProducts(trimmed);
      }
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  // 供应商输入变化
  const handleSupplierChange = (text: string) => {
    setSupplier(text);
    if (text.trim()) {
      const filtered = supplierHistory.filter(s =>
        s.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredSuppliers(filtered);
      setShowSupplierSuggestions(filtered.length > 0);
    } else {
      setFilteredSuppliers(supplierHistory);
      setShowSupplierSuggestions(supplierHistory.length > 0);
    }
  };

  // 产品输入变化
  const handleProductChange = (text: string) => {
    setProduct(text);
    if (text.trim()) {
      const filtered = productHistory.filter(p =>
        p.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredProducts(filtered);
      setShowProductSuggestions(filtered.length > 0);
    } else {
      setFilteredProducts(productHistory);
      setShowProductSuggestions(productHistory.length > 0);
    }
  };

  // 选择建议项
  const selectSupplier = (value: string) => {
    setSupplier(value);
    setShowSupplierSuggestions(false);
  };

  const selectProduct = (value: string) => {
    setProduct(value);
    setShowProductSuggestions(false);
  };

  const templates: ChecklistTemplate[] = [
    { id: 1, name: '电子产品通用模板', categories: 3, items: 15 },
    { id: 2, name: '服装纺织模板', categories: 4, items: 20 },
    { id: 3, name: '玩具安全模板', categories: 5, items: 25 },
    { id: 4, name: '食品包装模板', categories: 3, items: 18 },
  ];

  const aqlOptions = [
    { value: '0.65', label: 'AQL 0.65 (严格)' },
    { value: '1.0', label: 'AQL 1.0' },
    { value: '1.5', label: 'AQL 1.5' },
    { value: '2.5', label: 'AQL 2.5 (常规)' },
    { value: '4.0', label: 'AQL 4.0 (宽松)' },
  ];

  // AQL标准抽样表 (根据产品数量自动计算抽样数量)
  const calculateSampleSize = (qty: number, aqlLevel: string): number => {
    // AQL 2.5 抽样表
    if (qty <= 50) return 20;
    if (qty <= 90) return 32;
    if (qty <= 150) return 50;
    if (qty <= 280) return 80;
    if (qty <= 500) return 125;
    if (qty <= 1200) return 200;
    if (qty <= 3200) return 315;
    if (qty <= 10000) return 500;
    if (qty <= 35000) return 800;
    return 1250;
  };

  // 产品数量变化时自动计算抽样数量
  const handleQuantityChange = (text: string) => {
    setQuantity(text);
    const qty = parseInt(text, 10);
    if (!isNaN(qty) && qty > 0) {
      const calculated = calculateSampleSize(qty, aql);
      setSampleSize(calculated.toString());
    } else {
      setSampleSize('');
    }
  };

  // AQL变化时重新计算抽样数量
  const handleAqlChange = (value: string) => {
    setAql(value);
    const qty = parseInt(quantity, 10);
    if (!isNaN(qty) && qty > 0) {
      const calculated = calculateSampleSize(qty, value);
      setSampleSize(calculated.toString());
    }
  };

  const handleCreate = async () => {
    if (!supplier.trim()) {
      Alert.alert('提示', '请输入供应商名称');
      return;
    }
    if (!product.trim()) {
      Alert.alert('提示', '请输入产品名称');
      return;
    }
    if (!quantity.trim() || parseInt(quantity, 10) <= 0) {
      Alert.alert('提示', '请输入有效的产品数量');
      return;
    }
    if (!sampleSize) {
      Alert.alert('提示', '请输入产品数量以计算抽样数量');
      return;
    }
    if (!selectedTemplate) {
      Alert.alert('提示', '请选择验货清单模板');
      return;
    }

    // 保存到历史记录
    await saveToHistory('supplier', supplier);
    await saveToHistory('product', product);

    setLoading(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          productNo,
          supplier,
          product,
          quantity: parseInt(quantity, 10),
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
            <Text style={styles.label}>订单号</Text>
            <View style={styles.inputWrapper}>
              <Feather name="hash" size={20} color="#B2BEC3" />
              <TextInput
                style={styles.input}
                placeholder="请输入订单号"
                placeholderTextColor="#B2BEC3"
                value={orderNo}
                onChangeText={setOrderNo}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>货号</Text>
            <View style={styles.inputWrapper}>
              <Feather name="tag" size={20} color="#B2BEC3" />
              <TextInput
                style={styles.input}
                placeholder="请输入货号"
                placeholderTextColor="#B2BEC3"
                value={productNo}
                onChangeText={setProductNo}
              />
            </View>
          </View>

          {/* 供应商名称 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>供应商名称</Text>
            <View style={styles.inputWrapperWithSuggestions}>
              <View style={styles.inputWrapper}>
                <Feather name="home" size={20} color="#B2BEC3" />
                <TextInput
                  style={styles.input}
                  placeholder="请输入或选择供应商"
                  placeholderTextColor="#B2BEC3"
                  value={supplier}
                  onChangeText={handleSupplierChange}
                  onFocus={() => {
                    if (supplierHistory.length > 0) {
                      setShowSupplierSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSupplierSuggestions(false), 200);
                  }}
                />
              </View>
              {showSupplierSuggestions && filteredSuppliers.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <FlatList
                    data={filteredSuppliers.slice(0, 5)}
                    keyExtractor={(item) => item}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => selectSupplier(item)}
                      >
                        <Feather name="clock" size={16} color="#B2BEC3" />
                        <Text style={styles.suggestionText}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}
            </View>
          </View>

          {/* 产品名称 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>产品名称</Text>
            <View style={styles.inputWrapperWithSuggestions}>
              <View style={styles.inputWrapper}>
                <Feather name="box" size={20} color="#B2BEC3" />
                <TextInput
                  style={styles.input}
                  placeholder="请输入或选择产品"
                  placeholderTextColor="#B2BEC3"
                  value={product}
                  onChangeText={handleProductChange}
                  onFocus={() => {
                    if (productHistory.length > 0) {
                      setShowProductSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowProductSuggestions(false), 200);
                  }}
                />
              </View>
              {showProductSuggestions && filteredProducts.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <FlatList
                    data={filteredProducts.slice(0, 5)}
                    keyExtractor={(item) => item}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionItem}
                        onPress={() => selectProduct(item)}
                      >
                        <Feather name="clock" size={16} color="#B2BEC3" />
                        <Text style={styles.suggestionText}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}
            </View>
          </View>

          {/* 产品数量 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>产品数量</Text>
            <View style={styles.inputWrapper}>
              <Feather name="package" size={20} color="#B2BEC3" />
              <TextInput
                style={styles.input}
                placeholder="请输入产品数量"
                placeholderTextColor="#B2BEC3"
                value={quantity}
                onChangeText={handleQuantityChange}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* 抽样数量 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>抽样数量</Text>
            <View style={styles.sampleSizeDisplay}>
              <Feather name="check-circle" size={20} color="#4F46E5" />
              <Text style={styles.sampleSizeText}>
                {sampleSize ? `${sampleSize} 件（自动计算）` : '请输入产品数量'}
              </Text>
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
                onPress={() => handleAqlChange(option.value)}
              >
                <Text style={[styles.optionText, aql === option.value && styles.optionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 验货清单模板 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>验货清单模板</Text>
          <Text style={styles.sectionSubtitle}>选择要使用的检查清单模板</Text>

          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={[
                styles.templateCard,
                selectedTemplate?.id === template.id && styles.templateCardActive
              ]}
              onPress={() => setSelectedTemplate(template)}
            >
              <View style={styles.templateInfo}>
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateMeta}>
                  {template.categories} 个分类 · {template.items} 个检查项
                </Text>
              </View>
              <View style={[
                styles.radioCircle,
                selectedTemplate?.id === template.id && styles.radioCircleActive
              ]}>
                {selectedTemplate?.id === template.id && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 创建按钮 */}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? ['#9CA3AF', '#9CA3AF'] : ['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButtonGradient}
          >
            <Text style={styles.createButtonText}>
              {loading ? '创建中...' : '创建验货任务'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
    zIndex: 1,
  },
  inputWrapperWithSuggestions: {
    position: 'relative',
    zIndex: 100,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#1F2937',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 1000,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#374151',
  },
  sampleSizeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  sampleSizeText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#4F46E5',
    fontWeight: '500',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  optionText: {
    fontSize: 13,
    color: '#6B7280',
  },
  optionTextActive: {
    color: '#4F46E5',
    fontWeight: '500',
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  templateMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#4F46E5',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4F46E5',
  },
  createButton: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});
