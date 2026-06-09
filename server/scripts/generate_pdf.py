#!/usr/bin/env python3
"""
验货报告PDF生成脚本 - 使用reportlab支持中文
"""
import sys
import json
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# 注册中文字体
FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'
pdfmetrics.registerFont(TTFont('ChineseFont', FONT_PATH))

def generate_inspection_pdf(data, output_path):
    """生成验货报告PDF"""
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 20 * mm
    
    y = height - margin
    
    # 标题
    c.setFont('ChineseFont', 18)
    c.drawCentredString(width/2, y, '验货报告')
    y -= 15 * mm
    
    # 报告编号
    c.setFont('ChineseFont', 10)
    c.drawCentredString(width/2, y, f"报告编号: {data.get('inspection_number', 'N/A')}")
    y -= 15 * mm
    
    # 基本信息
    c.setFont('ChineseFont', 12)
    c.drawString(margin, y, '基本信息')
    y -= 8 * mm
    
    c.setFont('ChineseFont', 9)
    info_items = [
        f"产品名称: {data.get('product_name', 'N/A')}",
        f"供应商: {data.get('supplier', 'N/A')}",
        f"批次号: {data.get('batch_number', 'N/A')}",
        f"验货日期: {data.get('inspection_date', 'N/A')}",
        f"验货员: {data.get('inspector_name', data.get('created_by', 'N/A'))}",
        f"状态: {'已完成' if data.get('status') == 'completed' else '进行中'}",
    ]
    
    for item in info_items:
        c.drawString(margin + 5*mm, y, item)
        y -= 6 * mm
    
    y -= 5 * mm
    
    # 汇总
    c.setFont('ChineseFont', 12)
    c.drawString(margin, y, '汇总')
    y -= 8 * mm
    
    c.setFont('ChineseFont', 9)
    summary = data.get('summary', {})
    c.drawString(margin + 5*mm, y, f"通过: {summary.get('pass', 0)}")
    c.drawString(margin + 40*mm, y, f"不通过: {summary.get('fail', 0)}")
    c.drawString(margin + 75*mm, y, f"不适用: {summary.get('na', 0)}")
    c.drawString(margin + 110*mm, y, f"待检: {summary.get('pending', 0)}")
    y -= 10 * mm
    
    # 检查项
    c.setFont('ChineseFont', 12)
    c.drawString(margin, y, '检查项')
    y -= 8 * mm
    
    checklist_items = data.get('checklist_items', [])
    for item in checklist_items:
        item_name = f"{item.get('item_number', '')} {item.get('item_name', item.get('name', 'N/A'))}"
        result = item.get('result', 'pending')
        
        status_text = '待检'
        if result == 'pass':
            status_text = '通过'
        elif result == 'fail':
            status_text = '不通过'
        elif result == 'na':
            status_text = '不适用'
        
        text = f"{item_name} - {status_text}"
        c.setFont('ChineseFont', 8)
        c.drawString(margin + 5*mm, y, text)
        y -= 5 * mm
        
        # 添加照片
        photos = item.get('photos', [])
        if photos:
            photo_x = margin + 8*mm
            for photo_url in photos[:3]:
                full_path = photo_url.lstrip('/')
                if os.path.exists(full_path):
                    try:
                        c.drawImage(full_path, photo_x, y - 25*mm, width=25*mm, height=25*mm)
                        photo_x += 28*mm
                    except:
                        pass
            y -= 30 * mm
        
        if y < margin + 20*mm:
            c.showPage()
            y = height - margin
    
    # 缺陷记录
    defects = data.get('defects', [])
    if defects:
        y -= 5 * mm
        c.setFont('ChineseFont', 12)
        c.drawString(margin, y, '缺陷记录')
        y -= 8 * mm
        
        c.setFont('ChineseFont', 8)
        for defect in defects:
            severity_text = {'critical': '严重', 'major': '主要', 'minor': '轻微'}.get(defect.get('severity', 'minor'), '轻微')
            text = f"- {defect.get('description', 'N/A')} ({severity_text})"
            c.drawString(margin + 5*mm, y, text)
            y -= 5 * mm
    
    # 生成时间
    y -= 10 * mm
    c.setFont('ChineseFont', 7)
    c.drawCentredString(width/2, y, f"生成时间: {data.get('generated_time', 'N/A')}")
    
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
