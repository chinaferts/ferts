from coze_coding_dev_sdk.database import Base

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Double, Integer, Numeric, PrimaryKeyConstraint, Table, Text, text, ForeignKey, Index, String, JSON
from sqlalchemy.dialects.postgresql import OID
from typing import Optional
import datetime

from sqlalchemy.orm import Mapped, mapped_column

class HealthCheck(Base):
    __tablename__ = 'health_check'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='health_check_pkey'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))


t_pg_stat_statements = Table(
    'pg_stat_statements', Base.metadata,
    Column('userid', OID),
    Column('dbid', OID),
    Column('toplevel', Boolean),
    Column('queryid', BigInteger),
    Column('query', Text),
    Column('plans', BigInteger),
    Column('total_plan_time', Double(53)),
    Column('min_plan_time', Double(53)),
    Column('max_plan_time', Double(53)),
    Column('mean_plan_time', Double(53)),
    Column('stddev_plan_time', Double(53)),
    Column('calls', BigInteger),
    Column('total_exec_time', Double(53)),
    Column('min_exec_time', Double(53)),
    Column('max_exec_time', Double(53)),
    Column('mean_exec_time', Double(53)),
    Column('stddev_exec_time', Double(53)),
    Column('rows', BigInteger),
    Column('shared_blks_hit', BigInteger),
    Column('shared_blks_read', BigInteger),
    Column('shared_blks_dirtied', BigInteger),
    Column('shared_blks_written', BigInteger),
    Column('local_blks_hit', BigInteger),
    Column('local_blks_read', BigInteger),
    Column('local_blks_dirtied', BigInteger),
    Column('local_blks_written', BigInteger),
    Column('temp_blks_read', BigInteger),
    Column('temp_blks_written', BigInteger),
    Column('shared_blk_read_time', Double(53)),
    Column('shared_blk_write_time', Double(53)),
    Column('local_blk_read_time', Double(53)),
    Column('local_blk_write_time', Double(53)),
    Column('temp_blk_read_time', Double(53)),
    Column('temp_blk_write_time', Double(53)),
    Column('wal_records', BigInteger),
    Column('wal_fpi', BigInteger),
    Column('wal_bytes', Numeric),
    Column('jit_functions', BigInteger),
    Column('jit_generation_time', Double(53)),
    Column('jit_inlining_count', BigInteger),
    Column('jit_inlining_time', Double(53)),
    Column('jit_optimization_count', BigInteger),
    Column('jit_optimization_time', Double(53)),
    Column('jit_emission_count', BigInteger),
    Column('jit_emission_time', Double(53)),
    Column('jit_deform_count', BigInteger),
    Column('jit_deform_time', Double(53)),
    Column('stats_since', DateTime(True)),
    Column('minmax_stats_since', DateTime(True))
)


t_pg_stat_statements_info = Table(
    'pg_stat_statements_info', Base.metadata,
    Column('dealloc', BigInteger),
    Column('stats_reset', DateTime(True))
)


# ==================== 验货APP数据库模型 ====================

class Checklist(Base):
    """验货清单模板表"""
    __tablename__ = 'checklists'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='checklists_pkey'),
        Index('checklists_name_idx', 'name'),
        Index('checklists_created_at_idx', 'created_at'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment='清单名称')
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment='清单描述')
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment='分类')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), server_default=text('now()'), nullable=False)
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), onupdate=text('now()'), nullable=True)


class ChecklistItem(Base):
    """验货清单项目表"""
    __tablename__ = 'checklist_items'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='checklist_items_pkey'),
        Index('checklist_items_checklist_id_idx', 'checklist_id'),
        Index('checklist_items_order_idx', 'item_order'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    checklist_id: Mapped[int] = mapped_column(Integer, ForeignKey('checklists.id', ondelete='CASCADE'), nullable=False, comment='所属清单ID')
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment='检查项名称')
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment='检查项描述')
    item_type: Mapped[str] = mapped_column(String(50), nullable=False, default='pass_fail', comment='类型: pass_fail/photo/note/scoring')
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    item_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment='排序')
    scoring_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment='最低分(评分类型)')
    scoring_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment='最高分(评分类型)')
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), server_default=text('now()'), nullable=False)


class Inspection(Base):
    """验货任务表"""
    __tablename__ = 'inspections'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='inspections_pkey'),
        Index('inspections_status_idx', 'status'),
        Index('inspections_supplier_id_idx', 'supplier_id'),
        Index('inspections_scheduled_date_idx', 'scheduled_date'),
        Index('inspections_created_at_idx', 'created_at'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, comment='订单号')
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False, comment='供应商名称')
    supplier_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment='供应商ID')
    product_name: Mapped[str] = mapped_column(String(255), nullable=False, comment='产品名称')
    product_sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment='产品SKU')
    quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment='数量')
    checklist_id: Mapped[int] = mapped_column(Integer, ForeignKey('checklists.id'), nullable=False, comment='使用的清单ID')
    status: Mapped[str] = mapped_column(String(50), nullable=False, default='pending', comment='状态: pending/in_progress/completed/cancelled')
    inspector_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment='验货员姓名')
    inspector_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment='验货员ID')
    location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment='验货地点')
    scheduled_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), nullable=True, comment='计划日期')
    completed_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), nullable=True, comment='完成日期')
    overall_result: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment='总体结果: pass/fail/needs_review')
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment='备注')
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), server_default=text('now()'), nullable=False)
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), onupdate=text('now()'), nullable=True)


class InspectionRecord(Base):
    """验货记录表 - 每个检查项的执行结果"""
    __tablename__ = 'inspection_records'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='inspection_records_pkey'),
        Index('inspection_records_inspection_id_idx', 'inspection_id'),
        Index('inspection_records_item_id_idx', 'item_id'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inspection_id: Mapped[int] = mapped_column(Integer, ForeignKey('inspections.id', ondelete='CASCADE'), nullable=False, comment='验货任务ID')
    item_id: Mapped[int] = mapped_column(Integer, ForeignKey('checklist_items.id'), nullable=False, comment='清单项目ID')
    result: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment='结果: pass/fail/note/na')
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment='评分(如果适用)')
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment='备注')
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), server_default=text('now()'), nullable=False)
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), onupdate=text('now()'), nullable=True)


class Defect(Base):
    """缺陷记录表"""
    __tablename__ = 'defects'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='defects_pkey'),
        Index('defects_inspection_id_idx', 'inspection_id'),
        Index('defects_severity_idx', 'severity'),
        Index('defects_created_at_idx', 'created_at'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inspection_id: Mapped[int] = mapped_column(Integer, ForeignKey('inspections.id', ondelete='CASCADE'), nullable=False, comment='验货任务ID')
    title: Mapped[str] = mapped_column(String(255), nullable=False, comment='缺陷标题')
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment='缺陷描述')
    severity: Mapped[str] = mapped_column(String(50), nullable=False, default='minor', comment='严重程度: critical/major/minor')
    location_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment='位置描述')
    quantity: Mapped[Optional[int]] = mapped_column(Integer, default=1, nullable=True, comment='数量')
    photo_urls: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, comment='照片URL列表')
    status: Mapped[str] = mapped_column(String(50), nullable=False, default='open', comment='状态: open/resolved/accepted')
    resolved_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment='解决备注')
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), server_default=text('now()'), nullable=False)
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), onupdate=text('now()'), nullable=True)


class InspectionPhoto(Base):
    """验货照片表"""
    __tablename__ = 'inspection_photos'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='inspection_photos_pkey'),
        Index('inspection_photos_inspection_id_idx', 'inspection_id'),
        Index('inspection_photos_record_id_idx', 'record_id'),
        Index('inspection_photos_defect_id_idx', 'defect_id'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inspection_id: Mapped[int] = mapped_column(Integer, ForeignKey('inspections.id', ondelete='CASCADE'), nullable=False, comment='验货任务ID')
    record_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('inspection_records.id', ondelete='CASCADE'), nullable=True, comment='关联的检查记录ID')
    defect_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('defects.id', ondelete='CASCADE'), nullable=True, comment='关联的缺陷ID')
    photo_url: Mapped[str] = mapped_column(String(500), nullable=False, comment='照片URL')
    photo_type: Mapped[str] = mapped_column(String(50), nullable=False, default='general', comment='照片类型: general/check_item/defect/before/after')
    caption: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment='照片说明')
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), server_default=text('now()'), nullable=False)
