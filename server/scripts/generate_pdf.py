#!/usr/bin/env python3
"""
验货报告PDF生成脚本 - 使用reportlab支持中文
包含照片显示功能
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

# 注册中文字体 - 使用项目自带的文泉驿微米黑
script_dir = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(script_dir, 'wqy-microhei.ttc')
if not os.path.exists(FONT_PATH):
    raise FileNotFoundError(f'中文字体文件不存在: {FONT_PATH}')
# TTC 是字体集合，需要指定 subfontIndex（0 是第一个字体）
pdfmetrics.registerFont(TTFont('ChineseFont', FONT_PATH, subfontIndex=0))

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
    
    # 标题
    c.setFont('ChineseFont', 20)
    c.drawCentredString(width/2, y, '验货报告 / Inspection Report')
    y -= 12 * mm
    
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
    """绘制外箱内盒尺寸重量统计表"""
    outer_l = data.get('outer_carton_length')
    outer_w = data.get('outer_carton_width')
    outer_h = data.get('outer_carton_height')
    outer_g = data.get('outer_carton_weight')
    inner_l = data.get('inner_carton_length')
    inner_w = data.get('inner_carton_width')
    inner_h = data.get('inner_carton_height')
    inner_g = data.get('inner_carton_weight')

    # 如果所有尺寸都为空，不绘制
    if all(v is None for v in [outer_l, outer_w, outer_h, outer_g, inner_l, inner_w, inner_h, inner_g]):
        return y

    c.setFont('ChineseFont', 11)
    c.setFillColor(colors.HexColor('#4F46E5'))
    c.drawString(margin, y, '【 尺寸重量统计表 / Dimensional Table 】')
    y -= 6 * mm

    # 表格配置
    table_x = margin
    row_h = 7 * mm
    header_h = 9 * mm
    col_widths = [38*mm, 32*mm, 32*mm]
    total_w = sum(col_widths)

    def fmt(v):
        return f"{v}" if v is not None else "-"

    # 标题行
    header_y = y - header_h
    c.setFillColor(colors.HexColor('#EEF2FF'))
    c.rect(table_x, header_y, total_w, header_h, fill=1, stroke=1)
    c.setStrokeColor(colors.HexColor('#E5E7EB'))
    c.setLineWidth(0.5)
    c.rect(table_x, header_y, total_w, header_h, fill=0, stroke=1)
    c.setFillColor(colors.HexColor('#1F2937'))
    c.setFont('ChineseFont', 8)
    headers = ['', 'Master Carton\n外箱 (CM/KG)', 'Inner Carton\n内盒 (CM/KG)']
    x_pos = [table_x, table_x + col_widths[0], table_x + col_widths[0] + col_widths[1]]
    for i, h in enumerate(headers):
        c.drawCentredString(x_pos[i] + col_widths[i]/2, header_y + 2*mm, h)

    y = header_y

    # 数据行
    rows = [
        ('L 长 (CM)', fmt(outer_l), fmt(inner_l)),
        ('W 宽 (CM)', fmt(outer_w), fmt(inner_w)),
        ('H 高 (CM)', fmt(outer_h), fmt(inner_h)),
        ('G.W. 重量 (KG)', fmt(outer_g), fmt(inner_g)),
    ]

    for label, outer_val, inner_val in rows:
        row_y = y - row_h
        # 斑马纹
        bg = colors.HexColor('#F9FAFB') if rows.index((label, outer_val, inner_val)) % 2 == 0 else colors.white
        c.setFillColor(bg)
        c.rect(table_x, row_y, total_w, row_h, fill=1, stroke=1)
        # 边框
        c.setStrokeColor(colors.HexColor('#E5E7EB'))
        c.setLineWidth(0.5)
        c.rect(table_x, row_y, total_w, row_h, fill=0, stroke=1)

        c.setFillColor(colors.HexColor('#374151'))
        c.setFont('ChineseFont', 8)
        c.drawString(table_x + 3*mm, row_y + 2*mm, label)
        c.drawCentredString(table_x + col_widths[0] + col_widths[1]/2, row_y + 2*mm, outer_val)
        c.drawCentredString(table_x + col_widths[0] + col_widths[1] + col_widths[2]/2, row_y + 2*mm, inner_val)

        y = row_y

    y -= 5 * mm
    return y

def draw_photo(c, x, y, photo_path, max_display_width=50*mm, max_display_height=40*mm):
    """绘制单张照片，保持1600x1200分辨率，96DPI"""
    try:
        import io
        import uuid
        
        # 获取完整路径或下载网络图片
        if photo_path.startswith('http'):
            import requests
            response = requests.get(photo_path, timeout=10)
            if response.status_code == 200:
                img_data = response.content
            else:
                return 0
        else:
            full_path = get_full_photo_path(photo_path)
            if not full_path or not os.path.exists(full_path):
                print(f"照片文件不存在: {photo_path}")
                return 0
            with open(full_path, 'rb') as f:
                img_data = f.read()
        
        # 使用Pillow处理图片
        from PIL import Image
        img = Image.open(io.BytesIO(img_data))
        
        # 转换为RGB（处理PNG等格式）
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # 调整为1600x1200分辨率
        target_width = 1600
        target_height = 1200
        img = img.resize((target_width, target_height), Image.LANCZOS)
        
        draw_width = max_display_width
        draw_height = max_display_height
        
        # 保存到临时文件（高分辨率）
        tmp_path = f'/tmp/pdf_photo_{uuid.uuid4().hex[:8]}.jpg'
        img.save(tmp_path, 'JPEG', quality=90, optimize=True)
        
        # 绘制压缩后的图片
        c.drawImage(tmp_path, x, y - draw_height, width=draw_width, height=draw_height)
        
        # 绘制边框
        c.setStrokeColor(colors.HexColor('#E5E7EB'))
        c.setLineWidth(0.5)
        c.rect(x, y - draw_height, draw_width, draw_height)
        
        # 删除临时文件
        os.remove(tmp_path)
        
        return draw_height
    except Exception as e:
        print(f"绘制照片失败 {photo_path}: {e}")
        return 0

def draw_checklist(c, width, margin, y, height, data):
    """绘制检查项列表（包含照片），排除问题统计项"""
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
            description = item.get('description', '')
            result = item.get('status', item.get('result', 'pending'))
            photos = item.get('photos', []) or []
            
            # 估算需要的高度：名称(4mm) + 描述(4mm) + 照片行(如果有多张照片)
            required = 8 * mm
            if photos:
                required += photo_max_height + 5 * mm
            check_page_break(required)
            
            # 状态颜色
            status_colors = {
                'pass': ('✓ 通过', '#10B981'),
                'fail': ('✗ 不通过', '#EF4444'),
                'na': ('- 不适用', '#6B7280'),
                'pending': ('○ 待检', '#F59E0B'),
            }
            status_text, status_color = status_colors.get(result, ('○ 待检', '#F59E0B'))
            
            # 检查项名称
            c.setFont('ChineseFont', 9)
            c.setFillColor(colors.black)
            c.drawString(margin + 5*mm, y, f'• {item_name}')
            
            # 状态
            c.setFillColor(colors.HexColor(status_color))
            c.drawRightString(width - margin, y, status_text)
            y -= 4 * mm
            
            # 检验标准描述
            if description:
                c.setFont('ChineseFont', 8)
                c.setFillColor(colors.HexColor('#6B7280'))
                desc = description[:50] + '...' if len(description) > 50 else description
                c.drawString(margin + 10*mm, y, f'检验标准: {desc}')
                y -= 4 * mm
            
            # 绘制照片
            barcode_codes = item.get('barcodeCodes', []) or []
            notes = item.get('notes', '') or ''
            
            if photos:
                c.setFont('ChineseFont', 8)
                c.setFillColor(colors.HexColor('#4F46E5'))
                c.drawString(margin + 10*mm, y, f'📷 {len(photos)}张照片')
                y -= 4 * mm
                
                # 计算每行能放多少张照片
                content_width = width - 2 * margin - 10 * mm
                photos_per_row = max(1, int(content_width / (photo_max_width + photo_spacing)))
                
                photo_y = y - photo_max_height
                for i, photo_path in enumerate(photos):
                    photo_x = margin + 10*mm + (i % photos_per_row) * (photo_max_width + photo_spacing)
                    
                    # 如果当前行放不下，换行
                    if i > 0 and i % photos_per_row == 0:
                        photo_y -= photo_max_height + photo_spacing
                        check_page_break(photo_max_height + 10 * mm)
                    
                    draw_photo(c, photo_x, photo_y + photo_max_height, photo_path, photo_max_width, photo_max_height)
                
                y = photo_y - 5 * mm
            
            # 绘制条码（带格式）
            if barcode_codes:
                c.setFont('ChineseFont', 8)
                c.setFillColor(colors.HexColor('#059669'))
                # 显示条码和格式
                codes_with_format = []
                for i, code in enumerate(barcode_codes[:5]):
                    fmt = barcode_formats[i] if i < len(barcode_formats) else ''
                    if fmt:
                        codes_with_format.append(f'{code} [{fmt}]')
                    else:
                        codes_with_format.append(code)
                codes_text = ', '.join(codes_with_format)
                if len(barcode_codes) > 5:
                    codes_text += f' ... (+{len(barcode_codes) - 5})'
                c.drawString(margin + 10*mm, y, f'📱 条码: {codes_text}')
                y -= 4 * mm
            
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
            c.drawString(margin + 5*mm, y, f'• {item_name}')
            
            c.setFillColor(colors.HexColor(status_color))
            c.drawRightString(width - margin, y, status_text)
            y -= 4 * mm
            
            if description:
                c.setFont('ChineseFont', 8)
                c.setFillColor(colors.HexColor('#6B7280'))
                desc = description[:50] + '...' if len(description) > 50 else description
                c.drawString(margin + 10*mm, y, f'检验标准: {desc}')
                y -= 4 * mm
            
            if photos:
                c.setFont('ChineseFont', 8)
                c.setFillColor(colors.HexColor('#4F46E5'))
                c.drawString(margin + 10*mm, y, f'📷 {len(photos)}张照片')
                y -= 4 * mm
                
                content_width = width - 2 * margin - 10 * mm
                photos_per_row = max(1, int(content_width / (photo_max_width + photo_spacing)))
                
                photo_y = y - photo_max_height
                for i, photo_path in enumerate(photos):
                    photo_x = margin + 10*mm + (i % photos_per_row) * (photo_max_width + photo_spacing)
                    
                    if i > 0 and i % photos_per_row == 0:
                        photo_y -= photo_max_height + photo_spacing
                        check_page_break(photo_max_height + 10 * mm)
                    
                    draw_photo(c, photo_x, photo_y + photo_max_height, photo_path, photo_max_width, photo_max_height)
                
                y = photo_y - 5 * mm
            
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
        
        text = f'• {description} | 等级: {severity_text} | 数量: {quantity}'
        c.setFont('ChineseFont', 9)
        c.drawString(margin + 5*mm, y, text)
        y -= 5 * mm
    
    y -= 5 * mm
    return y

def draw_defect_statistics_table(c, width, margin, y, height, data):
    """绘制问题统计表格（在报告最后显示）"""
    # 从checklist_items中找到问题统计项
    checklist_items = data.get('checklist_items', [])
    defect_item = None
    for item in checklist_items:
        item_name = item.get('item_name', '') or item.get('name', '')
        if '问题统计' in item_name:
            defect_item = item
            break
    
    if not defect_item:
        return y
    
    # 如果y位置不够，换页
    if y < margin + 50 * mm:
        c.showPage()
        y = height - margin
    
    # 获取AQL信息
    aql = data.get('aql', '2.5')
    sample_size = data.get('sample_size', 0)
    
    # AQL允收数表（根据AQL等级）
    aql_accept_table = {
        '0.40': {'ac': 0, 're': 1},
        '0.65': {'ac': 1, 're': 2},
        '1.0': {'ac': 1, 're': 2},
        '1.5': {'ac': 2, 're': 3},
        '2.5': {'ac': 3, 're': 4},
        '4.0': {'ac': 5, 're': 6},
    }
    
    # 严重缺陷允收数固定为0（不允许任何严重缺陷）
    critical_ac = 0
    critical_re = 1
    
    # 主要/轻微缺陷根据AQL等级确定
    aql_info = aql_accept_table.get(str(aql), {'ac': 3, 're': 4})
    major_ac = aql_info['ac']
    major_re = aql_info['re']
    minor_ac = aql_info['ac']
    minor_re = aql_info['re']
    
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
    if photos:
        y -= 5 * mm
        c.setFont('ChineseFont', 9)
        c.setFillColor(colors.HexColor('#6B7280'))
        c.drawString(margin, y, f'问题照片 ({len(photos)}张):')
        y -= 5 * mm
        
        photo_max_width = 40 * mm
        photo_max_height = 35 * mm
        photo_x = margin
        photos_per_row = 4
        
        for i, photo in enumerate(photos):
            if i > 0 and i % photos_per_row == 0:
                y -= photo_max_height + 3 * mm
                photo_x = margin
            
            photo_path = get_full_photo_path(photo.get('url', ''))
            if photo_path and os.path.exists(photo_path):
                try:
                    draw_photo(c, photo_x, y - photo_max_height, photo_path, photo_max_width, photo_max_height)
                    photo_x += photo_max_width + 3 * mm
                except Exception as e:
                    print(f"绘制问题照片失败: {e}")
    
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
    
    generate_inspection_pdf(data, output_path)
