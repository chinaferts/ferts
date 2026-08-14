#!/usr/bin/env python3
"""
验货报告PDF生成脚本 - 使用reportlab支持中文
包含照片显示功能
VERSION: 2026-08-10-v6-BILINGUAL
"""
import sys
import json
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors

# 版本标记 - 用于确认生产环境使用的代码版本
print('[PDF VERSION] 2026-08-10-v6-BILINGUAL: Bilingual Chinese-English PDF report', file=sys.stderr)

# 中英文翻译映射表
TRANSLATIONS = {
    # 报告标题
    '验货报告': 'Inspection Report',
    '检验概况': 'Inspection Summary',
    '检验日期': 'Inspection Date',
    '客户名称': 'Client',
    '产品名称': 'Product',
    '订单号': 'Order No.',
    '检验数量': 'Inspection Qty',
    '检验结果': 'Result',
    '通过': 'Pass',
    '不通过': 'Fail',
    '待确认': 'Pending',
    '检验员': 'Inspector',
    '备注': 'Remarks',

    # 检查项类型
    '问题统计以及拍照并描述': 'Issue Statistics with Photos & Description',
    '组装以及功能测试拍照': 'Assembly & Function Test Photos',
    '与签样对比拍照': 'Comparison with Signed Sample Photos',
    '条码扫描以及拍照': 'Barcode Scanning & Photos',
    '产品细节拍照（包括产品尺寸和重量照）': 'Product Detail Photos (incl. Size & Weight)',
    '内箱箱唛以及尺寸重量拍照': 'Inner Box Marking & Size/Weight Photos',
    '彩盒/彩卡信息以及其规格重量拍照': 'Color Box/Card Info & Spec/Weight Photos',
    '外箱箱唛以及尺寸重量拍照': 'Outer Box Marking & Size/Weight Photos',
    '外箱跌落测试拍照': 'Outer Box Drop Test Photos',
    '包装以及配件拍照': 'Packaging & Accessories Photos',
    '封箱拍照': 'Sealing Photos',

    # 检验标准
    '检验标准': 'Inspection Standard',
    '检查产品细节、尺寸和重量照': 'Check product details, dimensions and weight',
    '拍摄产品细节、尺寸和重量照': 'Photograph product details, dimensions and weight',
    '检查内箱唛头及规格重量': 'Check inner box marking and specifications/weight',
    '检查彩盒信息及规格重量': 'Check color box info and specifications/weight',
    '检查外箱唛头及规格重量': 'Check outer box marking and specifications/weight',
    '扫描所有含有条码的地方': 'Scan all areas containing barcodes',

    # 状态和标签
    '通过': 'Pass',
    '不通过': 'Fail',
    '待确认': 'Pending',
    '照片': 'Photos',
    '张': 'pcs',
    '个条码': 'barcodes',
    '扫描结果': 'Scan Results',
    '无扫描结果': 'No scan results',

    # 问题等级
    '严重问题': 'Critical Issues',
    '主要问题': 'Major Issues',
    '次要问题': 'Minor Issues',

    # 其他
    '备注': 'Remarks',
    '检验员': 'Inspector',
    '日期': 'Date',
    '签名': 'Signature',
}

def t(chinese_text):
    """翻译函数：返回中英文双语字符串"""
    if not chinese_text:
        return ''
    en_text = TRANSLATIONS.get(chinese_text, '')
    if en_text:
        return f'{chinese_text} / {en_text}'
    return chinese_text

def get_en_desc(chinese_desc):
    """获取检验标准的英文翻译"""
    if not chinese_desc:
        return ''
    en = TRANSLATIONS.get(chinese_desc, '')
    if en:
        return en
    # 尝试部分匹配
    for cn, en_trans in TRANSLATIONS.items():
        if cn in chinese_desc:
            return en_trans
    return ''

# 注册中文字体 - 使用项目自带的文泉驿微米黑
script_dir = os.path.dirname(os.path.abspath(__file__))
# 多路径查找字体：脚本目录 → 生产环境原路径 → 备选路径
FONT_CANDIDATES = [
    os.path.join(script_dir, 'wqy-microhei.ttc'),
    '/opt/bytefaas/server/scripts/wqy-microhei.ttc',
    '/opt/bytefaas/scripts/wqy-microhei.ttc',
]
FONT_PATH = None
for candidate in FONT_CANDIDATES:
    if os.path.exists(candidate):
        FONT_PATH = candidate
        break
if not FONT_PATH:
    raise FileNotFoundError(f'中文字体文件不存在，已搜索路径：{FONT_CANDIDATES}')

# TTC 是字体集合，需要指定 subfontIndex（0 是第一个字体）
pdfmetrics.registerFont(TTFont('ChineseFont', FONT_PATH, subfontIndex=0))
print(f'[INFO] 中文字体注册成功：{FONT_PATH}', file=sys.stderr)

def find_file(filename):
    """在多个路径中查找文件"""
    candidates = [
        os.path.join(script_dir, filename),
        f'/tmp/{filename}',
        f'/opt/bytefaas/server/scripts/{filename}',
        f'/opt/bytefaas/scripts/{filename}',
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return None

# 服务器uploads目录基础路径
# 开发环境: /workspace/projects/server
# 生产环境: /tmp (照片存储在 /tmp/uploads/photos/)
UPLOADS_BASE_PATH = '/tmp' if os.path.exists('/tmp/uploads') else '/workspace/projects/server'

def get_full_photo_path(photo_path):
    """将相对路径转换为完整路径"""
    if not photo_path:
        return None
    
    # 如果是完整路径，直接返回
    if photo_path.startswith('/workspace') or photo_path.startswith('/tmp') or photo_path.startswith('http'):
        return photo_path
    
    # 相对路径（如 /uploads/photos/xxx.jpg）
    clean_path = photo_path.lstrip('/')
    full_path = os.path.join(UPLOADS_BASE_PATH, clean_path)
    
    # 如果文件不存在，尝试其他可能的路径
    if not os.path.exists(full_path):
        # 尝试 /tmp/uploads/
        alt_path = os.path.join('/tmp', clean_path)
        if os.path.exists(alt_path):
            return alt_path
        # 尝试 /workspace/projects/server/
        alt_path = os.path.join('/workspace/projects/server', clean_path)
        if os.path.exists(alt_path):
            return alt_path
    
    return full_path

def draw_header(c, width, margin, data):
    """绘制报告头部区域"""
    y = height - margin
    
    # 大标题字体大小和高度
    title_font_size = 20
    title_height = title_font_size * 0.35 * mm  # 约 7mm
    
    # 绘制 LOGO（左侧，与大标题同高度、同一水平线）
    logo_path = find_file('ferts_logo.png')
    logo_width = 35 * mm
    logo_height = title_height  # 与大标题高度一致
    try:
        if os.path.exists(logo_path):
            # LOGO 底部与大标题文字基线对齐
            c.drawImage(logo_path, margin, y, width=logo_width, height=logo_height, preserveAspectRatio=True, mask='auto')
            print(f'[PDF header] LOGO 已绘制: {logo_path}, 尺寸: {logo_width:.1f}x{logo_height:.1f}mm')
        else:
            print(f'[PDF header] LOGO 文件不存在: {logo_path}')
    except Exception as e:
        print(f'[PDF header] LOGO 绘制失败: {e}')
    
    # 大标题 - 公司名称（右侧，与 LOGO 同一水平线）
    c.setFont('ChineseFont', title_font_size)
    c.setFillColor(colors.HexColor('#333333'))
    text_x = margin + logo_width + 5 * mm
    c.drawString(text_x, y, '杭州福致自行车用品有限公司')
    y -= 9 * mm
    
    # 副标题
    c.setFont('ChineseFont', 11)
    c.setFillColor(colors.HexColor('#666666'))
    c.drawCentredString(width / 2, y, '验货报告 / Inspection Report')
    y -= 8 * mm
    
    # 分隔线
    c.setStrokeColor(colors.HexColor('#4F46E5'))
    c.setLineWidth(2)
    c.line(margin, y, width - margin, y)
    y -= 8 * mm
    
    return y

def draw_info_table(c, width, margin, y, data):
    """绘制表头信息表格"""
    c.setFont('ChineseFont', 11)
    c.setFillColor(colors.HexColor('#4F46E5'))
    c.drawString(margin, y, '【 验货信息 / Inspection Info 】')
    y -= 6 * mm
    
    # 表格数据 - 两列布局
    col1_x = margin
    col2_x = width / 2 + 5 * mm
    row_height = 6 * mm
    
    info_rows = [
        ('订单号 / Order No:', data.get('order_number', data.get('orderNo', 'N/A'))),
        ('供应商 / Supplier:', data.get('supplier', data.get('supplier_name', 'N/A'))),
        ('产品名称 / Product:', data.get('product_name', 'N/A')),
        ('产品编号 / SKU:', data.get('product_sku', data.get('productNo', 'N/A'))),
        ('数量 / Quantity:', str(data.get('quantity', 'N/A'))),
        ('抽样数 / Sample Size:', str(data.get('sample_size', data.get('sampleSize', 'N/A')))),
        ('AQL标准 / AQL:', str(data.get('aql', 'N/A'))),
        ('检验日期 / Date:', data.get('inspection_date', data.get('created_at', 'N/A'))[:10] if data.get('created_at') else 'N/A'),
        ('验货员 / Inspector:', data.get('inspector_name', data.get('created_by', 'N/A'))),
        ('整体结果 / Result:', '合格 / PASS' if data.get('overall_result') == 'pass' else '不合格 / FAIL'),
    ]
    
    c.setFillColor(colors.black)
    c.setFont('ChineseFont', 9)
    
    for i, (label, value) in enumerate(info_rows):
        row_y = y - (i // 2) * row_height
        x = col1_x if i % 2 == 0 else col2_x
        
        # 标签
        c.setFont('ChineseFont', 9)
        c.drawString(x, row_y, label)
        
        # 值
        c.setFont('ChineseFont', 9)
        c.setFillColor(colors.HexColor('#1F2937'))
        c.drawString(x + 35 * mm, row_y, str(value))
        c.setFillColor(colors.black)
    
    # 计算最后的y位置
    rows_count = (len(info_rows) + 1) // 2
    y = y - rows_count * row_height - 5 * mm
    
    return y

def draw_summary(c, width, margin, y, data):
    """绘制汇总信息"""
    c.setFont('ChineseFont', 11)
    c.setFillColor(colors.HexColor('#4F46E5'))
    c.drawString(margin, y, '【 检验汇总 / Summary 】')
    y -= 6 * mm
    
    summary = data.get('summary', {})
    pass_count = summary.get('pass', 0)
    fail_count = summary.get('fail', 0)
    na_count = summary.get('na', 0)
    pending_count = summary.get('pending', 0)
    
    # 汇总统计框
    box_y = y - 15 * mm
    box_width = (width - 2 * margin - 6 * mm) / 4
    
    stats = [
        ('通过 Pass', pass_count, '#10B981'),
        ('不通过 Fail', fail_count, '#EF4444'),
        ('不适用 N/A', na_count, '#6B7280'),
        ('待检 Pending', pending_count, '#F59E0B'),
    ]
    
    for i, (label, count, color) in enumerate(stats):
        x = margin + i * (box_width + 2 * mm)
        
        # 背景框
        c.setFillColor(colors.HexColor(color))
        c.roundRect(x, box_y, box_width, 12 * mm, 3 * mm, fill=1, stroke=0)
        
        # 文字
        c.setFillColor(colors.white)
        c.setFont('ChineseFont', 8)
        c.drawCentredString(x + box_width/2, box_y + 7 * mm, label)
        c.setFont('ChineseFont', 14)
        c.drawCentredString(x + box_width/2, box_y + 2 * mm, str(count))
    
    c.setFillColor(colors.black)
    y = box_y - 8 * mm
    
    return y

def draw_dimensions_table(c, width, margin, y, data):
    """绘制外箱内盒产品尺寸重量统计表"""
    outer_l = data.get('outer_carton_length')
    outer_w = data.get('outer_carton_width')
    outer_h = data.get('outer_carton_height')
    outer_g = data.get('outer_carton_weight')
    inner_l = data.get('inner_carton_length')
    inner_w = data.get('inner_carton_width')
    inner_h = data.get('inner_carton_height')
    inner_g = data.get('inner_carton_weight')
    prod_l = data.get('product_length')
    prod_w = data.get('product_width')
    prod_h = data.get('product_height')
    prod_g = data.get('product_weight')

    # 始终绘制尺寸重量统计表（即使数据为空）
    c.setFont('ChineseFont', 11)
    c.setFillColor(colors.HexColor('#4F46E5'))
    c.drawString(margin, y, '【 尺寸重量统计表 / Dimensional Table 】')
    y -= 6 * mm

    # 表格配置 - 使用页面全宽（减去左右边距）
    table_x = margin
    table_width = width - 2 * margin  # 表格总宽度 = 页面宽度 - 左右边距
    row_h = 8 * mm
    header_h = 10 * mm
    # 按比例分配列宽：第一列20%，第二列27%，第三列27%，第四列26%
    col_widths = [table_width * 0.20, table_width * 0.27, table_width * 0.27, table_width * 0.26]
    total_w = sum(col_widths)

    def fmt(v):
        return f"{v}" if v is not None else "-"

    # 标题行
    header_y = y - header_h
    c.setFillColor(colors.HexColor('#4F46E5'))
    c.rect(table_x, header_y, total_w, header_h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont('ChineseFont', 9)
    headers = ['', 'Master Carton 外箱 (CM/KG)', 'Inner Carton 内盒 (CM/KG)', 'Product 产品 (CM/KG)']
    x_pos = [table_x, table_x + col_widths[0], table_x + col_widths[0] + col_widths[1], table_x + col_widths[0] + col_widths[1] + col_widths[2]]
    for i, h in enumerate(headers):
        c.drawCentredString(x_pos[i] + col_widths[i]/2, header_y + 3*mm, h)

    y = header_y

    # 数据行
    rows = [
        ('L 长 (CM)', fmt(outer_l), fmt(inner_l), fmt(prod_l)),
        ('W 宽 (CM)', fmt(outer_w), fmt(inner_w), fmt(prod_w)),
        ('H 高 (CM)', fmt(outer_h), fmt(inner_h), fmt(prod_h)),
        ('G.W. 重量 (KG)', fmt(outer_g), fmt(inner_g), fmt(prod_g)),
    ]

    for idx, (label, outer_val, inner_val, prod_val) in enumerate(rows):
        row_y = y - row_h
        # 斑马纹 - 使用更柔和的颜色
        bg = colors.HexColor('#F9FAFB') if idx % 2 == 0 else colors.white
        c.setFillColor(bg)
        c.rect(table_x, row_y, total_w, row_h, fill=1, stroke=0)
        # 边框
        c.setStrokeColor(colors.HexColor('#E5E7EB'))
        c.setLineWidth(0.5)
        c.rect(table_x, row_y, total_w, row_h, fill=0, stroke=1)

        # 第一列左对齐，加粗
        c.setFillColor(colors.HexColor('#1F2937'))
        c.setFont('ChineseFont', 9)
        c.drawString(table_x + 4*mm, row_y + 2.5*mm, label)
        # 第二列、第三列和第四列居中
        c.setFillColor(colors.HexColor('#374151'))
        c.setFont('ChineseFont', 9)
        c.drawCentredString(table_x + col_widths[0] + col_widths[1]/2, row_y + 2.5*mm, outer_val)
        c.drawCentredString(table_x + col_widths[0] + col_widths[1] + col_widths[2]/2, row_y + 2.5*mm, inner_val)
        c.drawCentredString(table_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3]/2, row_y + 2.5*mm, prod_val)

        y = row_y

    y -= 5 * mm
    return y

def draw_photo(c, x, y, photo_path, max_display_width=50*mm, max_display_height=40*mm):
    """绘制单张照片，保持1600x1200分辨率，96DPI"""
    try:
        import io
        import uuid
        
        print(f"[PDF draw_photo] 开始绘制照片: {photo_path[:80]}...")
        
        # 获取完整路径或下载网络图片
        if photo_path.startswith('http'):
            import urllib.request
            try:
                req = urllib.request.Request(photo_path, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    img_data = resp.read()
                print(f"[PDF draw_photo] 下载成功, 大小: {len(img_data)} bytes")
            except Exception as e:
                print(f"[PDF draw_photo] 下载照片异常: {e}")
                return 0
        else:
            full_path = get_full_photo_path(photo_path)
            if not full_path or not os.path.exists(full_path):
                print(f"[PDF draw_photo] 照片文件不存在: {photo_path}")
                return 0
            with open(full_path, 'rb') as f:
                img_data = f.read()
            print(f"[PDF draw_photo] 本地文件读取成功, 大小: {len(img_data)} bytes")
        
        # 使用Pillow处理图片
        from PIL import Image
        img = Image.open(io.BytesIO(img_data))
        print(f"[PDF draw_photo] 图片原始尺寸: {img.size}")
        
        # 转换为RGB（处理PNG等格式）
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # 保持宽高比缩放，适配目标显示区域
        target_width = 1600
        target_height = 1200
        img.thumbnail((target_width, target_height), Image.LANCZOS)
        
        draw_width = max_display_width
        draw_height = max_display_height
        
        # 保存到临时文件（高分辨率）
        tmp_path = f'/tmp/pdf_photo_{uuid.uuid4().hex[:8]}.jpg'
        img.save(tmp_path, 'JPEG', quality=90, optimize=True)
        print(f"[PDF draw_photo] 保存到临时文件: {tmp_path}")
        
        # 绘制压缩后的图片
        c.drawImage(tmp_path, x, y - draw_height, width=draw_width, height=draw_height)
        print(f"[PDF draw_photo] 绘制成功, 位置: ({x}, {y - draw_height}), 尺寸: {draw_width}x{draw_height}")
        
        # 绘制边框
        c.setStrokeColor(colors.HexColor('#E5E7EB'))
        c.setLineWidth(0.5)
        c.rect(x, y - draw_height, draw_width, draw_height)
        
        # 删除临时文件
        os.remove(tmp_path)
        
        return draw_height
    except Exception as e:
        print(f"[PDF draw_photo] 绘制照片失败: {e}")
        import traceback
        traceback.print_exc()
        return 0

def draw_checklist(c, width, margin, y, height, data):
    """绘制检查项列表（包含照片），排除问题统计项"""
    # 检查项名称中英文映射
    ITEM_NAME_EN_MAP = {
        '大货仓库照以及码堆照片': 'Warehouse & Stacking',
        '外箱箱唛以及尺寸重量拍照': 'Carton Marking & Dimensions',
        '内箱箱唛以及尺寸重量拍照': 'Inner Carton Marking & Dimensions',
        '产品细节拍照（包括产品尺寸和重量照）': 'Product Detail',
        '产品细节拍照': 'Product Detail',
        '彩盒/彩卡信息以及其规格重量拍照': 'Color Box/Manual & Specs',
        '与签样对比拍照': 'Sample Comparison',
        '组装以及功能测试拍照': 'Assembly & Function Test',
        '条码扫描以及拍照': 'Barcode Scan',
        '条码扫描': 'Barcode Scan',
        '问题统计以及拍照并描述': 'Problem Statistics',
        '问题描述': 'Problem Statistics',
    }
    
    def get_en_name(cn_name):
        """获取英文检查项名称（支持模糊匹配）"""
        # 先尝试精确匹配
        if cn_name in ITEM_NAME_EN_MAP:
            return ITEM_NAME_EN_MAP[cn_name]
        
        # 模糊匹配：检查 cn_name 是否包含映射表中的键
        for key, value in ITEM_NAME_EN_MAP.items():
            if key in cn_name or cn_name in key:
                return value
        
        # 如果没有匹配，返回原名称
        return cn_name
    
    c.setFont('ChineseFont', 11)
    c.setFillColor(colors.HexColor('#4F46E5'))
    c.drawString(margin, y, '【 检验项目 / Inspection Items 】')
    y -= 6 * mm
    
    # 过滤掉问题统计项（将在单独的表格中显示）
    checklist_items = [item for item in data.get('checklist_items', []) 
                       if '问题统计' not in (item.get('item_name', '') or item.get('name', ''))]
    
    categories = data.get('categories', [])
    
    # 照片配置
    photo_max_width = 45 * mm
    photo_max_height = 40 * mm
    photo_spacing = 3 * mm
    
    def check_page_break(required_height):
        nonlocal y
        if y < margin + required_height:
            c.showPage()
            y = height - margin
    
    if categories:
        # 按checklist_items的原始顺序显示，只在category变化时显示分类标题
        last_category = None
        for item in checklist_items:
            category = item.get('category', '')
            
            # 只在category变化时显示分类标题
            if category != last_category:
                check_page_break(15 * mm)
                c.setFont('ChineseFont', 10)
                c.setFillColor(colors.HexColor('#374151'))
                c.drawString(margin, y, f'▸ {category}')
                y -= 5 * mm
                last_category = category
            
            item_name = item.get('item_name', item.get('name', 'N/A'))
            item_name_en = item.get('name_en', '')
            # 如果 name_en 为空，尝试从 ITEM_NAME_EN_MAP 获取
            if not item_name_en:
                item_name_en = get_en_name(item_name)
            description = item.get('description', '')
            result = item.get('status', item.get('result', 'pending'))
            photos = item.get('photos', []) or []
            
            # 检查项标题需要的高度（名称 + 英文名 + 描述 + 状态）
            required = 15 * mm
            check_page_break(required)
            
            # 状态颜色
            status_colors = {
                'pass': ('✓ 通过 / PASS', '#10B981'),
                'fail': ('✗ 不通过 / FAIL', '#EF4444'),
                'na': ('- 不适用 / N/A', '#6B7280'),
                'pending': ('○ 待检 / PENDING', '#F59E0B'),
            }
            status_text, status_color = status_colors.get(result, ('○ 待检 / PENDING', '#F59E0B'))
            
            # 检查项名称（中英双语：英文 + 中文）
            c.setFont('ChineseFont', 9)
            c.setFillColor(colors.black)
            if item_name_en:
                c.drawString(margin + 5*mm, y, f'• {item_name} {item_name_en}')
            else:
                c.drawString(margin + 5*mm, y, f'• {item_name}')
            
            # 状态
            c.setFillColor(colors.HexColor(status_color))
            c.drawRightString(width - margin, y, status_text)
            y -= 4 * mm
            
            # 检验标准描述（中英双语）
            if description:
                c.setFont('ChineseFont', 8)
                c.setFillColor(colors.HexColor('#6B7280'))
                desc = description[:50] + '...' if len(description) > 50 else description
                desc_en = get_en_desc(description)
                if desc_en:
                    c.drawString(margin + 10*mm, y, f'检验标准/Standard: {desc}')
                    y -= 3.5 * mm
                    c.drawString(margin + 10*mm, y, f'  {desc_en}')
                else:
                    c.drawString(margin + 10*mm, y, f'检验标准/Standard: {desc}')
                y -= 4 * mm
            
            # 绘制照片（全部显示，不限张数，自动换行和分页）
            barcode_codes = item.get('barcodeCodes', []) or []
            barcode_formats = item.get('barcodeFormats', []) or []
            notes = item.get('notes', '') or ''
            
            # 绘制条码扫描结果表格
            if barcode_codes:
                # 从 data 获取订单条码
                order_barcode = data.get('order_barcode', data.get('orderBarcode', '')) or ''
                
                # 计算表格所需高度：标题 + 3行数据
                table_total_height = 5*mm + 3*6*mm + 2*mm
                
                # 检查是否有足够空间，不足则换页
                if y < margin + table_total_height:
                    c.showPage()
                    y = height - margin
                
                c.setFont('ChineseFont', 9)
                c.setFillColor(colors.HexColor('#000000'))
                # 表格标题
                c.drawString(margin + 10*mm, y, '条码扫描结果 / Barcode Scan Results')
                y -= 5 * mm
                
                # 表格边框和标题
                table_x = margin + 10*mm
                table_width = width - 2*margin - 10*mm
                row_height = 6 * mm
                
                # 绘制表格行
                table_data = [
                    ('条形码能被扫描 / Barcode Scannable', '合格 / PASS'),
                    ('已扫描的条形码 / Scanned Barcode', ', '.join(barcode_codes[:5])),
                    ('扫描的格式 / Scan Format', barcode_formats[0] if barcode_formats else ''),
                ]
                
                c.setFont('ChineseFont', 9)
                for label, value in table_data:
                    # 绘制边框
                    c.setStrokeColor(colors.HexColor('#CCCCCC'))
                    c.setLineWidth(0.5)
                    c.rect(table_x, y - row_height + 1*mm, table_width, row_height)
                    
                    # 绘制标签
                    c.setFillColor(colors.HexColor('#000000'))
                    c.drawString(table_x + 2*mm, y - row_height + 2*mm, label)
                    
                    # 绘制值
                    c.drawString(table_x + table_width/2, y - row_height + 2*mm, str(value))
                    y -= row_height
                
                y -= 2 * mm
            
            if photos:
                print(f"[PDF checklist] 渲染检查项 '{item_name}' 的 {len(photos)} 张照片", file=sys.stderr)
                c.setFont('ChineseFont', 8)
                c.setFillColor(colors.HexColor('#4F46E5'))
                c.drawString(margin + 10*mm, y, f' {len(photos)}张照片 / Photos')
                y -= 4 * mm
                
                # 计算每行能放多少张照片
                content_width = width - 2 * margin - 10 * mm
                photos_per_row = max(1, int(content_width / (photo_max_width + photo_spacing)))
                
                # 逐张绘制照片，自动换行和分页
                print(f"[PDF checklist] 开始绘制 {len(photos)} 张照片，photos_per_row={photos_per_row}, y={y:.1f}mm, margin={margin:.1f}mm, height={height:.1f}mm", file=sys.stderr)
                
                row_height = photo_max_height + photo_spacing
                current_y = y  # 当前行的顶部位置
                col = 0  # 当前列
                
                for i, photo_path in enumerate(photos):
                    # 每行开始时（第一张照片），检查当前页是否有足够空间
                    if col == 0:
                        # 检查当前行底部是否超出页面边距
                        row_bottom = current_y - photo_max_height
                        print(f"[PDF checklist] 照片 {i+1}: col=0, current_y={current_y:.1f}mm, row_bottom={row_bottom:.1f}mm, margin+2mm={margin+2*mm:.1f}mm", file=sys.stderr)
                        if row_bottom < margin + 2*mm:
                            # 空间不足，换到下一页
                            print(f"[PDF checklist] 照片 {i+1}: 空间不足，换页", file=sys.stderr)
                            c.showPage()
                            current_y = height - margin
                            col = 0
                            print(f"[PDF checklist] 照片 {i+1}: 换页后 current_y={current_y:.1f}mm", file=sys.stderr)
                    
                    # 计算当前照片的位置
                    photo_x = margin + 10*mm + col * (photo_max_width + photo_spacing)
                    
                    print(f"[PDF checklist] 照片 {i+1}/{len(photos)}: col={col}, current_y={current_y:.1f}mm, photo_x={photo_x:.1f}mm", file=sys.stderr)
                    
                    # 绘制照片
                    draw_photo(c, photo_x, current_y, photo_path, photo_max_width, photo_max_height)
                    
                    col += 1
                    
                    # 一行满后换行
                    if col >= photos_per_row:
                        col = 0
                        current_y -= row_height
                        print(f"[PDF checklist] 照片 {i+1}: 行满，current_y={current_y:.1f}mm", file=sys.stderr)
                
                # 如果最后一行不满，也要更新 current_y
                if col > 0:
                    current_y -= row_height
                
                y = current_y  # 更新主 y 坐标
                print(f"[PDF checklist] 绘制完成，最终 y={y:.1f}")
                
                # 额外间距
                y -= 2 * mm
            
            # 绘制备注
            if notes:
                c.setFont('ChineseFont', 8)
                c.setFillColor(colors.HexColor('#6B7280'))
                notes_text = notes[:60] + '...' if len(notes) > 60 else notes
                c.drawString(margin + 10*mm, y, f'📝 备注: {notes_text}')
                y -= 4 * mm
            
            y -= 3 * mm
    else:
        # 无分类，直接显示
        for item in checklist_items:
            item_name = item.get('item_name', item.get('name', 'N/A'))
            item_name_en = item.get('name_en', '')
            description = item.get('description', '')
            result = item.get('status', item.get('result', 'pending'))
            photos = item.get('photos', []) or []
            barcode_codes = item.get('barcodeCodes', []) or []
            barcode_formats = item.get('barcodeFormats', []) or []
            notes = item.get('notes', '') or ''
            
            required = 8 * mm
            if photos:
                required += photo_max_height + 5 * mm
            check_page_break(required)
            
            status_colors = {
                'pass': ('✓ 通过', '#10B981'),
                'fail': ('✗ 不通过', '#EF4444'),
                'na': ('- 不适用', '#6B7280'),
                'pending': ('○ 待检', '#F59E0B'),
            }
            status_text, status_color = status_colors.get(result, ('○ 待检', '#F59E0B'))
            
            c.setFont('ChineseFont', 9)
            c.setFillColor(colors.black)
            if item_name_en:
                c.drawString(margin + 5*mm, y, f'• {item_name} {item_name_en}')
            else:
                c.drawString(margin + 5*mm, y, f'• {item_name}')
            
            c.setFillColor(colors.HexColor(status_color))
            c.drawRightString(width - margin, y, status_text)
            y -= 4 * mm
            
            if description:
                c.setFont('ChineseFont', 8)
                c.setFillColor(colors.HexColor('#6B7280'))
                desc = description[:50] + '...' if len(description) > 50 else description
                desc_en = get_en_desc(description)
                if desc_en:
                    c.drawString(margin + 10*mm, y, f'Standard/检验标准: {desc_en} {desc}')
                else:
                    c.drawString(margin + 10*mm, y, f'检验标准/Standard: {desc}')
                y -= 4 * mm
            
            if photos:
                print(f'[PDF checklist] Drawing {len(photos)} photos (no categories) at y={y/mm:.1f}mm', file=sys.stderr)
                sys.stderr.flush()
                
                c.setFont('ChineseFont', 8)
                c.setFillColor(colors.HexColor('#4F46E5'))
                c.drawString(margin + 10*mm, y, f' {len(photos)}张照片 / Photos')
                y -= 4 * mm
                
                content_width = width - 2 * margin - 10 * mm
                photos_per_row = max(1, int(content_width / (photo_max_width + photo_spacing)))
                row_height = photo_max_height + photo_spacing
                
                current_y = y
                col = 0
                
                for i, photo_path in enumerate(photos):
                    if col == 0:
                        row_bottom = current_y - photo_max_height
                        if row_bottom < margin + 2*mm:
                            print(f'[PDF checklist] Page break before photo {i+1}: current_y={current_y/mm:.1f}mm, row_bottom={row_bottom/mm:.1f}mm', file=sys.stderr)
                            sys.stderr.flush()
                            c.showPage()
                            current_y = height - margin
                            col = 0
                    
                    photo_x = margin + 10*mm + col * (photo_max_width + photo_spacing)
                    draw_photo(c, photo_x, current_y, photo_path, photo_max_width, photo_max_height)
                    
                    col += 1
                    if col >= photos_per_row:
                        col = 0
                        current_y -= row_height
                
                if col != 0:
                    current_y -= row_height
                
                y = current_y - 5 * mm
                
                # 绘制条码扫描结果表格
                if barcode_codes:
                    # 从 data 获取订单条码
                    order_barcode = data.get('order_barcode', data.get('orderBarcode', '')) or ''
                    
                    # 计算表格所需高度：标题 + 3行数据
                    table_total_height = 5*mm + 3*6*mm + 2*mm
                    
                    # 检查是否有足够空间，不足则换页
                    if y < margin + table_total_height:
                        c.showPage()
                        y = height - margin
                    
                    c.setFont('ChineseFont', 9)
                    c.setFillColor(colors.HexColor('#000000'))
                    # 表格标题
                    c.drawString(margin + 10*mm, y, '条码扫描结果 / Barcode Scan Results')
                    y -= 5 * mm
                    
                    # 表格边框和标题
                    table_x = margin + 10*mm
                    table_width = width - 2*margin - 10*mm
                    row_height = 6 * mm
                    
                    # 绘制表格行
                    table_data = [
                        ('条形码能被扫描 / Barcode Scannable', '合格 / PASS'),
                        ('已扫描的条形码 / Scanned Barcode', ', '.join(barcode_codes[:5])),
                        ('扫描的格式 / Scan Format', barcode_formats[0] if barcode_formats else ''),
                    ]
                    
                    c.setFont('ChineseFont', 9)
                    for label, value in table_data:
                        # 绘制边框
                        c.setStrokeColor(colors.HexColor('#CCCCCC'))
                        c.setLineWidth(0.5)
                        c.rect(table_x, y - row_height + 1*mm, table_width, row_height)
                        
                        # 绘制标签
                        c.setFillColor(colors.HexColor('#000000'))
                        c.drawString(table_x + 2*mm, y - row_height + 2*mm, label)
                        
                        # 绘制值
                        c.drawString(table_x + table_width/2, y - row_height + 2*mm, str(value))
                        y -= row_height
                    
                    y -= 2 * mm
            
            y -= 3 * mm
    
    y -= 5 * mm
    return y

def draw_defects(c, width, margin, y, height, data):
    """绘制缺陷记录"""
    defects = data.get('defects', [])
    if not defects:
        return y
    
    if y < margin + 40 * mm:
        c.showPage()
        y = height - margin
    
    c.setFont('ChineseFont', 11)
    c.setFillColor(colors.HexColor('#EF4444'))
    c.drawString(margin, y, '【 缺陷记录 / Defects 】')
    y -= 6 * mm
    
    c.setFillColor(colors.black)
    
    for defect in defects:
        if y < margin + 20 * mm:
            c.showPage()
            y = height - margin
        
        description = defect.get('description', 'N/A')
        severity = defect.get('severity', 'minor')
        severity_map = {'critical': '严重', 'major': '主要', 'minor': '轻微'}
        severity_text = severity_map.get(severity, '轻微')
        quantity = defect.get('quantity', 1)
        photos = defect.get('photo_urls', []) or []
        
        text = f'• {description} | 等级: {severity_text} | 数量: {quantity}'
        c.setFont('ChineseFont', 9)
        c.drawString(margin + 5*mm, y, text)
        y -= 5 * mm
        
        # 显示问题照片
        if photos:
            print(f"[PDF defects] 绘制缺陷照片: {len(photos)}张")
            for photo_path in photos:
                if y < margin + 45 * mm:
                    c.showPage()
                    y = height - margin
                
                # 绘制照片（最大宽度120mm，高度80mm）
                photo_width = 120 * mm
                photo_height = 80 * mm
                
                # 计算实际绘制尺寸（保持宽高比）
                draw_width = photo_width
                draw_height = photo_height
                
                draw_photo(c, margin + 5*mm, y, photo_path, draw_width, draw_height)
                y -= photo_height + 3 * mm
                
                # 显示问题描述
                if description and description != 'N/A':
                    c.setFont('ChineseFont', 8)
                    c.setFillColor(colors.HexColor('#6B7280'))
                    desc_text = f'问题描述：{description}'
                    # 如果描述太长，截断
                    if len(desc_text) > 80:
                        desc_text = desc_text[:80] + '...'
                    c.drawString(margin + 5*mm, y, desc_text)
                    y -= 4 * mm
                    c.setFillColor(colors.black)
                
                y -= 2 * mm
    
    y -= 5 * mm
    return y

def draw_defect_statistics_table(c, width, margin, y, height, data):
    """绘制问题统计表格（在报告最后显示）"""
    # 从checklist_items中找到问题统计项
    checklist_items = data.get('checklist_items', [])
    print(f"[PDF defect_stats] checklist_items 总数: {len(checklist_items)}")
    defect_item = None
    for item in checklist_items:
        item_name = item.get('item_name', '') or item.get('name', '')
        if '问题统计' in item_name:
            defect_item = item
            print(f"[PDF defect_stats] 找到问题统计项: {item_name}, photos: {len(item.get('photos', []))}")
            break
    
    if not defect_item:
        print(f"[PDF defect_stats] 未找到问题统计项")
        return y
    
    # 如果y位置不够，换页
    if y < margin + 50 * mm:
        c.showPage()
        y = height - margin
    
    # 获取AQL信息
    aql = data.get('aql', '2.5')
    sample_size = data.get('sample_size', 0)
    
    # AQL抽样检验标准表 (ISO 2859-1, 正常检验水平II)
    # 格式: { 抽样数量: { AQL值: (Ac, Re) } }
    # Ac = 允收数 (Accept), Re = 拒收数 (Reject)
    # 数据来源: AQL抽样标准表（一般检查水平II）
    aql_table = {
        2:    {'0.65': (0,1), '1.0': (0,1), '1.5': (0,1), '2.5': (0,1), '4.0': (0,1), '6.0': (0,1)},
        3:    {'0.65': (0,1), '1.0': (0,1), '1.5': (0,1), '2.5': (0,1), '4.0': (0,1), '6.0': (0,1)},
        5:    {'0.65': (0,1), '1.0': (0,1), '1.5': (0,1), '2.5': (0,1), '4.0': (0,1), '6.0': (1,2)},
        8:    {'0.65': (0,1), '1.0': (0,1), '1.5': (0,1), '2.5': (0,1), '4.0': (1,2), '6.0': (1,2)},
        13:   {'0.65': (0,1), '1.0': (0,1), '1.5': (0,1), '2.5': (1,2), '4.0': (1,2), '6.0': (2,3)},
        20:   {'0.65': (0,1), '1.0': (0,1), '1.5': (1,2), '2.5': (1,2), '4.0': (2,3), '6.0': (3,4)},
        32:   {'0.65': (0,1), '1.0': (1,2), '1.5': (1,2), '2.5': (2,3), '4.0': (3,4), '6.0': (5,6)},
        50:   {'0.65': (1,2), '1.0': (1,2), '1.5': (2,3), '2.5': (3,4), '4.0': (5,6), '6.0': (7,8)},
        80:   {'0.65': (1,2), '1.0': (2,3), '1.5': (3,4), '2.5': (5,6), '4.0': (7,8), '6.0': (10,11)},
        125:  {'0.65': (2,3), '1.0': (3,4), '1.5': (5,6), '2.5': (7,8), '4.0': (10,11), '6.0': (14,15)},
        200:  {'0.65': (3,4), '1.0': (5,6), '1.5': (7,8), '2.5': (10,11), '4.0': (14,15), '6.0': (21,22)},
        315:  {'0.65': (5,6), '1.0': (7,8), '1.5': (10,11), '2.5': (14,15), '4.0': (21,22), '6.0': (21,22)},
        500:  {'0.65': (7,8), '1.0': (10,11), '1.5': (14,15), '2.5': (21,22), '4.0': (21,22), '6.0': (21,22)},
        800:  {'0.65': (10,11), '1.0': (14,15), '1.5': (21,22), '2.5': (21,22), '4.0': (21,22), '6.0': (21,22)},
        1250: {'0.65': (14,15), '1.0': (21,22), '1.5': (21,22), '2.5': (21,22), '4.0': (21,22), '6.0': (21,22)},
        2000: {'0.65': (21,22), '1.0': (21,22), '1.5': (21,22), '2.5': (21,22), '4.0': (21,22), '6.0': (21,22)},
    }
    
    # 根据抽样数量查找对应的AQL行
    def get_aql_row(size):
        for threshold in sorted(aql_table.keys()):
            if size <= threshold:
                return aql_table[threshold]
        return aql_table[2000]  # 超过2000使用最大值
    
    aql_row = get_aql_row(sample_size)
    aql_key = str(aql)
    
    # 严重缺陷允收数固定为0（不允许任何严重缺陷）
    critical_ac = 0
    critical_re = 1
    
    # 主要缺陷根据AQL等级和抽样数量确定
    major_ac, major_re = aql_row.get(aql_key, (7, 8))
    
    # 轻微缺陷使用AQL 4.0标准
    minor_aql_key = '4.0'
    minor_ac, minor_re = aql_row.get(minor_aql_key, (10, 11))
    
    # 标题
    c.setFont('ChineseFont', 11)
    c.setFillColor(colors.HexColor('#EF4444'))
    c.drawString(margin, y, '【 问题统计表 / Defect Statistics 】')
    y -= 8 * mm
    
    # 显示AQL信息
    c.setFont('ChineseFont', 9)
    c.setFillColor(colors.HexColor('#6B7280'))
    c.drawString(margin, y, f'AQL: {aql} | 抽样数量: {sample_size} | 允收数(Critical: {critical_ac}, Major: {major_ac}, Minor: {minor_ac})')
    y -= 6 * mm
    
    c.setFillColor(colors.black)
    
    # 绘制表格
    table_x = margin
    table_width = width - 2 * margin
    row_height = 8 * mm
    
    # 表头
    c.setFillColor(colors.HexColor('#FEE2E2'))
    c.rect(table_x, y - row_height, table_width, row_height, fill=1, stroke=1)
    c.setFillColor(colors.HexColor('#991B1B'))
    c.setFont('ChineseFont', 9)
    headers = ['缺陷类型 / Defect Type', '数量 / Qty', '严重程度 / Severity', '允收数 / Ac', '检验结果 / Result']
    col_widths = [table_width * 0.28, table_width * 0.12, table_width * 0.20, table_width * 0.12, table_width * 0.28]
    x_pos = table_x + 2 * mm
    for i, header in enumerate(headers):
        c.drawString(x_pos, y - row_height + 2.5 * mm, header)
        x_pos += col_widths[i]
    y -= row_height
    
    # 表格边框
    c.setStrokeColor(colors.HexColor('#EF4444'))
    c.setLineWidth(1)
    
    # 获取缺陷统计数据
    critical_count = defect_item.get('critical_count', defect_item.get('critical', 0))
    major_count = defect_item.get('major_count', defect_item.get('major', 0))
    minor_count = defect_item.get('minor_count', defect_item.get('minor', 0))
    status = defect_item.get('status', defect_item.get('result', 'unchecked'))
    
    # 计算每种缺陷的合格/不合格状态
    # 如果有任何严重缺陷，直接不合格；否则根据允收数判断
    if status == 'pass':
        # 已提交合格 - 使用提交时的结果
        critical_result = 'pass'
        major_result = 'pass'
        minor_result = 'pass'
    elif status == 'fail':
        # 已提交不合格 - 使用提交时的结果
        critical_result = 'fail'
        major_result = 'fail'
        minor_result = 'fail'
    else:
        # 未提交 - 根据缺陷数量和允收数判断
        # Critical: 允收数为0，超过0即不合格
        critical_result = 'fail' if critical_count > critical_ac else 'pass'
        # Major: 超过允收数即不合格
        major_result = 'fail' if major_count > major_ac else 'pass'
        # Minor: 超过允收数即不合格
        minor_result = 'fail' if minor_count > minor_ac else 'pass'
    
    defect_rows = [
        ('严重缺陷 Critical', str(critical_count), '严重 Critical', str(critical_ac), critical_result),
        ('主要缺陷 Major', str(major_count), '主要 Major', str(major_ac), major_result),
        ('轻微缺陷 Minor', str(minor_count), '轻微 Minor', str(minor_ac), minor_result),
    ]
    
    for idx, (defect_type, qty, severity, ac, result) in enumerate(defect_rows):
        # 交替背景色
        if idx % 2 == 0:
            c.setFillColor(colors.HexColor('#FEF2F2'))
        else:
            c.setFillColor(colors.white)
        c.rect(table_x, y - row_height, table_width, row_height, fill=1, stroke=0)
        
        c.setFont('ChineseFont', 9)
        x_pos = table_x + 2 * mm
        values = [defect_type, qty, severity, ac, '']  # 最后一列根据result判断
        for i, val in enumerate(values):
            if i == 4:  # 结果列，根据result状态显示不同颜色和文字
                if result == 'pass':
                    c.setFillColor(colors.HexColor('#059669'))
                    c.drawString(x_pos, y - row_height + 2.5 * mm, '✓ 合格')
                else:
                    c.setFillColor(colors.HexColor('#EF4444'))
                    c.drawString(x_pos, y - row_height + 2.5 * mm, '✗ 不合格')
            else:
                c.setFillColor(colors.black)
                c.drawString(x_pos, y - row_height + 2.5 * mm, val)
            x_pos += col_widths[i]
        
        # 画行边框
        c.setStrokeColor(colors.HexColor('#FECACA'))
        c.line(table_x, y - row_height, table_x + table_width, y - row_height)
        y -= row_height
    
    # 画表格底部边框
    c.line(table_x, y, table_x + table_width, y)
    
    # 画表格左右边框
    c.line(table_x, y, table_x, y + len(defect_rows) * row_height)
    c.line(table_x + table_width, y, table_x + table_width, y + len(defect_rows) * row_height)
    
    # 绘制问题照片（如果有）
    photos = defect_item.get('photos', []) or []
    print(f"[PDF defect_stats] 问题照片数量：{len(photos)}")
    if photos:
        y -= 5 * mm
        c.setFont('ChineseFont', 9)
        c.setFillColor(colors.HexColor('#6B7280'))
        c.drawString(margin, y, f'问题照片 ({len(photos)}张):')
        y -= 5 * mm
        
        photo_max_width = 40 * mm
        photo_max_height = 35 * mm
        photo_spacing = 3 * mm
        photos_per_row = 4
        
        # 绘制照片，每页固定显示 6 行，超过自动换页
        print(f"[PDF defect] 开始绘制 {len(photos)} 张问题照片，photos_per_row={photos_per_row}")
        
        max_rows_per_page = 5  # 每页最多 5 行（A4 页面可用高度 237mm，5 行×43mm=215mm）
        row_height = photo_max_height + photo_spacing
        current_y = y  # 当前行的顶部位置
        col = 0  # 当前列
        rows_on_this_page = 0  # 当前页已绘制的行数
        
        for i, photo in enumerate(photos):
            # 如果当前页已满 6 行，换页
            if rows_on_this_page >= max_rows_per_page and col == 0:
                print(f"[PDF defect] 照片 {i+1}: 当前页已满 {max_rows_per_page} 行，换页")
                c.showPage()
                current_y = height - margin
                rows_on_this_page = 0
            
            # 计算当前照片的位置
            photo_x = margin + col * (photo_max_width + photo_spacing)
            photo_y = current_y  # 照片顶部对齐 current_y
            
            # 兼容字符串 URL 和字典{'url': '...'}两种格式
            if isinstance(photo, str):
                photo_url = photo
            elif isinstance(photo, dict):
                photo_url = photo.get('url', '')
            else:
                photo_url = str(photo) if photo else ''
            
            # HTTP URL 直接传给 draw_photo（内部会下载），本地文件才检查存在性
            if photo_url.startswith('http'):
                try:
                    draw_photo(c, photo_x, photo_y, photo_url, photo_max_width, photo_max_height)
                except Exception as e:
                    print(f"绘制问题照片失败：{e}")
            else:
                photo_path = get_full_photo_path(photo_url)
                if photo_path and os.path.exists(photo_path):
                    try:
                        draw_photo(c, photo_x, photo_y, photo_path, photo_max_width, photo_max_height)
                    except Exception as e:
                        print(f"绘制问题照片失败：{e}")
            
            col += 1
            
            # 一行满后换行
            if col >= photos_per_row:
                col = 0
                current_y -= row_height
                rows_on_this_page += 1
        
        # 如果最后一行不满，也要更新 current_y 和行数
        if col > 0:
            current_y -= row_height
            rows_on_this_page += 1
        
        y = current_y  # 更新主 y 坐标
        print(f"[PDF defect] 绘制完成，最终 y={y:.1f}, 共{rows_on_this_page}行")
    y -= 10 * mm
    return y

def draw_footer(c, width, margin, y, data):
    """绘制页脚"""
    c.setStrokeColor(colors.HexColor('#E5E7EB'))
    c.setLineWidth(1)
    c.line(margin, y, width - margin, y)
    y -= 5 * mm
    
    c.setFont('ChineseFont', 8)
    c.setFillColor(colors.HexColor('#9CA3AF'))
    c.drawString(margin, y, f'报告生成时间: {data.get("generated_time", "N/A")}')
    c.drawRightString(width - margin, y, '验货报告系统 / Inspection System')
    
    c.setFillColor(colors.black)

def generate_inspection_pdf(data, output_path):
    """生成验货报告PDF"""
    global height
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 20 * mm
    
    # 绘制头部
    y = draw_header(c, width, margin, data)
    
    # 绘制表头信息
    y = draw_info_table(c, width, margin, y, data)
    
    # 绘制汇总
    y = draw_summary(c, width, margin, y, data)

    # 绘制尺寸重量统计表
    y = draw_dimensions_table(c, width, margin, y, data)

    # 绘制检查项（包含照片）
    y = draw_checklist(c, width, margin, y, height, data)
    
    # 绘制缺陷记录
    y = draw_defects(c, width, margin, y, height, data)
    
    # 绘制问题统计表（报告最后）
    y = draw_defect_statistics_table(c, width, margin, y, height, data)
    
    # 绘制页脚
    draw_footer(c, width, margin, margin, data)
    
    c.save()
    print(f"PDF生成成功: {output_path}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python generate_pdf.py <json_file_path>")
        sys.exit(1)
    
    json_path = sys.argv[1]
    output_path = json_path.replace('.json', '.pdf')
    
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 调试：输出检查项照片信息
    checklist_items = data.get('checklist_items', [])
    print(f"[PDF main] 总共 {len(checklist_items)} 个检查项")
    for item in checklist_items:
        item_name = item.get('item_name', '') or item.get('name', '')
        photos = item.get('photos', []) or []
        if photos:
            print(f"[PDF main] 检查项 '{item_name}' 有 {len(photos)} 张照片: {photos[0][:80]}...")
    
    generate_inspection_pdf(data, output_path)
