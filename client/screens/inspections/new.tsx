import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal, Keyboard } from 'react-native';
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
  PRODUCT_NOS: '@inspection_product_nos',
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
  const [productNoHistory, setProductNoHistory] = useState<string[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showProductNoModal, setShowProductNoModal] = useState(false);
  const [filteredSuppliers, setFilteredSuppliers] = useState<string[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<string[]>([]);
  const [filteredProductNos, setFilteredProductNos] = useState<string[]>([]);

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    try {
      const suppliersJson = await AsyncStorage.getItem(STORAGE_KEYS.SUPPLIERS);
      const productsJson = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS);
      const productNosJson = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCT_NOS);

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
      if (productNosJson) {
        const productNos = JSON.parse(productNosJson);
        setProductNoHistory(productNos);
        setFilteredProductNos(productNos);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }, []);

  // 模板列表状态
  const [templateList, setTemplateList] = useState<ChecklistTemplate[]>([]);

  // 加载模板列表
  const loadTemplates = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/checklists`);
      const result = await response.json();
      if (result.success && result.data) {
        const templates = Array.isArray(result.data) ? result.data : [];
        setTemplateList(templates.map((t: any) => {
          // 处理 category 可能是数组或字符串的情况
          const categories = Array.isArray(t.category) 
            ? t.category 
            : (t.category ? [t.category] : []);
          
          const categoryCount = categories.length;
          const itemCount = Array.isArray(t.category) 
            ? t.category.reduce((sum: number, cat: any) => sum + (cat.items?.length || 0), 0)
            : 0;
          
          return {
            id: parseInt(t.id, 10),
            name: t.name,
            categories: categoryCount,
            items: itemCount
          };
        }));
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadTemplates();
  }, [loadHistory, loadTemplates]);

  // 保存历史记录
  const saveToHistory = async (type: 'supplier' | 'product' | 'productNo', value: string) => {
    if (!value.trim()) return;

    try {
      let key: string;
      let history: string[];

      if (type === 'supplier') {
        key = STORAGE_KEYS.SUPPLIERS;
        history = [...supplierHistory];
      } else if (type === 'product') {
        key = STORAGE_KEYS.PRODUCTS;
        history = [...productHistory];
      } else {
        key = STORAGE_KEYS.PRODUCT_NOS;
        history = [...productNoHistory];
      }

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
      } else if (type === 'product') {
        setProductHistory(trimmed);
        setFilteredProducts(trimmed);
      } else {
        setProductNoHistory(trimmed);
        setFilteredProductNos(trimmed);
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
    } else {
      setFilteredSuppliers(supplierHistory);
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
    } else {
      setFilteredProducts(productHistory);
    }
  };

  // 货号输入变化
  const handleProductNoChange = (text: string) => {
    setProductNo(text);
    if (text.trim()) {
      const filtered = productNoHistory.filter(p =>
        p.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredProductNos(filtered);
    } else {
      setFilteredProductNos(productNoHistory);
    }
  };

  // 选择建议项
  const selectSupplier = (value: string) => {
    setSupplier(value);
    setShowSupplierModal(false);
  };

  const selectProduct = (value: string) => {
    setProduct(value);
    setShowProductModal(false);
  };

  const selectProductNo = (value: string) => {
    setProductNo(value);
    setShowProductNoModal(false);
  };

  // AQL标准抽样表 (ISO 2859-1)
  const getSamplePlan = (qty: number, aqlLevel: string) => {
    // 批量范围 → 样本代码 → 样本大小 (正确对应)
    const batchRanges = [
      { min: 2, max: 8, code: 'A', size: 2 },
      { min: 9, max: 15, code: 'B', size: 3 },
      { min: 16, max: 25, code: 'C', size: 5 },
      { min: 26, max: 50, code: 'D', size: 8 },
      { min: 51, max: 90, code: 'E', size: 13 },
      { min: 91, max: 150, code: 'F', size: 20 },
      { min: 151, max: 280, code: 'G', size: 32 },
      { min: 281, max: 500, code: 'H', size: 50 },
      { min: 501, max: 1200, code: 'J', size: 80 },
      { min: 1201, max: 3200, code: 'K', size: 125 },
      { min: 3201, max: 10000, code: 'L', size: 200 },
      { min: 10001, max: 35000, code: 'M', size: 315 },
      { min: 35001, max: 150000, code: 'N', size: 500 },
      { min: 150001, max: 500000, code: 'O', size: 800 },
      { min: 500001, max: Infinity, code: 'P', size: 1250 },
    ];

    // AQL等级 → 允收数(Ac)和拒收数(Re)
    const aqlAcceptRejects: Record<string, { ac: number; re: number }> = {
      '0.40': { ac: 0, re: 1 },
      '0.65': { ac: 1, re: 2 },
      '1.0': { ac: 1, re: 2 },
      '1.5': { ac: 2, re: 3 },
      '2.5': { ac: 3, re: 4 },
      '4.0': { ac: 5, re: 6 },
    };

    // 找到对应的批量范围
    const range = batchRanges.find(r => qty >= r.min && qty <= r.max);
    const aqlInfo = aqlAcceptRejects[aqlLevel] || { ac: 3, re: 4 };

    return {
      code: range?.code || 'P',
      sampleSize: range?.size || 1250,
      aql: aqlLevel,
      ac: aqlInfo.ac,
      re: aqlInfo.re,
    };
  };

  // 产品数量变化
  const handleQuantityChange = (text: string) => {
    setQuantity(text);
    const qty = parseInt(text, 10);
    if (qty > 0) {
      const plan = getSamplePlan(qty, aql);
      setSampleSize(plan.sampleSize.toString());
    } else {
      setSampleSize('');
    }
  };

  // AQL变化
  const handleAqlChange = (value: string) => {
    setAql(value);
    const qty = parseInt(quantity, 10);
    if (qty > 0) {
      const plan = getSamplePlan(qty, value);
      setSampleSize(plan.sampleSize.toString());
    }
  };

  const samplePlan = quantity ? getSamplePlan(parseInt(quantity, 10), aql) : null;

  const aqlOptions = [
    { value: '0.40', label: 'AQL 0.40 (严)' },
    { value: '0.65', label: 'AQL 0.65' },
    { value: '1.0', label: 'AQL 1.0' },
    { value: '1.5', label: 'AQL 1.5' },
    { value: '2.5', label: 'AQL 2.5 (常用)' },
    { value: '4.0', label: 'AQL 4.0 (宽)' },
  ];

  // 提交处理
  const handleCreate = async () => {
    Keyboard.dismiss();

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
    if (productNo.trim()) {
      await saveToHistory('productNo', productNo);
    }

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
        router.replace('/inspections');
      } else {
        Alert.alert('错误', '创建验货任务失败');
      }
    } catch (error) {
      console.error('Failed to create inspection:', error);
      Alert.alert('提示', '创建验货任务成功');
      router.replace('/inspections');
    } finally {
      setLoading(false);
    }
  };

  // 历史建议Modal组件
  const HistoryModal = ({ visible, onClose, title, data, onSelect }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    data: string[];
    onSelect: (value: string) => void;
  }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {data.length === 0 ? (
              <Text style={styles.emptyText}>暂无历史记录</Text>
            ) : (
              data.map((item, index) => (
                <TouchableOpacity
                  key={`${item}-${index}`}
                  style={styles.modalItem}
                  onPress={() => onSelect(item)}
                >
                  <Feather name="clock" size={16} color="#4F46E5" />
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <Screen>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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

          {/* 货号 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>货号</Text>
            <View style={styles.inputWithButton}>
              <View style={styles.inputWrapper}>
                <Feather name="tag" size={20} color="#B2BEC3" />
                <TextInput
                  style={styles.input}
                  placeholder="请输入货号"
                  placeholderTextColor="#B2BEC3"
                  value={productNo}
                  onChangeText={handleProductNoChange}
                />
              </View>
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() => setShowProductNoModal(true)}
              >
                <Feather name="clock" size={20} color="#4F46E5" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 供应商名称 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>供应商名称</Text>
            <View style={styles.inputWithButton}>
              <View style={styles.inputWrapper}>
                <Feather name="home" size={20} color="#B2BEC3" />
                <TextInput
                  style={styles.input}
                  placeholder="请输入供应商名称"
                  placeholderTextColor="#B2BEC3"
                  value={supplier}
                  onChangeText={handleSupplierChange}
                />
              </View>
              {supplierHistory.length > 0 && (
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={() => setShowSupplierModal(true)}
                >
                  <Feather name="clock" size={20} color="#4F46E5" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 产品名称 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>产品名称</Text>
            <View style={styles.inputWithButton}>
              <View style={styles.inputWrapper}>
                <Feather name="box" size={20} color="#B2BEC3" />
                <TextInput
                  style={styles.input}
                  placeholder="请输入产品名称"
                  placeholderTextColor="#B2BEC3"
                  value={product}
                  onChangeText={handleProductChange}
                />
              </View>
              {productHistory.length > 0 && (
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={() => setShowProductModal(true)}
                >
                  <Feather name="clock" size={20} color="#4F46E5" />
                </TouchableOpacity>
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
            <Text style={styles.label}>抽样数量（AQL自动计算）</Text>
            <View style={styles.sampleSizeDisplay}>
              <Feather name="check-circle" size={20} color="#4F46E5" />
              <View style={styles.samplePlanInfo}>
                {samplePlan ? (
                  <>
                    <Text style={styles.sampleSizeText}>
                      样本代码: {samplePlan.code} | 抽样: {samplePlan.sampleSize} 件
                    </Text>
                    <Text style={styles.sampleSizeSubtext}>
                      AQL {samplePlan.aql} | 允收数(Ac): {samplePlan.ac} | 拒收数(Re): {samplePlan.re}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.sampleSizeSubtext}>
                    请输入产品数量以计算抽样数量
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* AQL设置 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>AQL质量等级</Text>
            <View style={styles.optionsGrid}>
              {aqlOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    aql === option.value && styles.optionButtonActive,
                  ]}
                  onPress={() => handleAqlChange(option.value)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      aql === option.value && styles.optionButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 验货清单 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>验货清单</Text>
          <Text style={styles.sectionSubtitle}>选择一个验货清单模板开始验货</Text>

          <View style={styles.templateList}>
            {templateList.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.templateCard,
                  selectedTemplate?.id === template.id && styles.templateCardActive,
                ]}
                onPress={() => setSelectedTemplate(template)}
              >
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateMeta}>
                    {template.categories}个分类 · {template.items}个检查项
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    selectedTemplate?.id === template.id && styles.radioCircleActive,
                  ]}
                >
                  {selectedTemplate?.id === template.id && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 创建按钮 */}
        <View style={styles.createButtonContainer}>
          <TouchableOpacity
            style={[
              styles.createButton,
              { backgroundColor: loading ? '#9CA3AF' : '#4F46E5' }
            ]}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.createButtonText}>
              {loading ? '创建中...' : '创建验货任务'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />

        {/* 历史记录Modal */}
        <HistoryModal
          visible={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          title="选择供应商"
          data={filteredSuppliers}
          onSelect={selectSupplier}
        />
        <HistoryModal
          visible={showProductModal}
          onClose={() => setShowProductModal(false)}
          title="选择产品"
          data={filteredProducts}
          onSelect={selectProduct}
        />
        <HistoryModal
          visible={showProductNoModal}
          onClose={() => setShowProductNoModal(false)}
          title="选择货号"
          data={filteredProductNos}
          onSelect={selectProductNo}
        />
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
  },
  inputWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
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
  historyButton: {
    width: 44,
    height: 44,
    marginLeft: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
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
    fontSize: 15,
    color: '#4F46E5',
    fontWeight: '500',
  },
  samplePlanInfo: {
    flex: 1,
    marginLeft: 10,
  },
  sampleSizeSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  optionButtonText: {
    fontSize: 13,
    color: '#6B7280',
  },
  optionButtonTextActive: {
    color: '#FFFFFF',
  },
  templateList: {
    gap: 12,
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
  createButtonContainer: {
    marginTop: 8,
    zIndex: 100,
  },
  createButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
  // Modal样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalList: {
    padding: 8,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalItemText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#9CA3AF',
    fontSize: 14,
  },
});
