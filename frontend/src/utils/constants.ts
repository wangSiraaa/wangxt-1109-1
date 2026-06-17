import { UserRole, ToolRiskLevel, ApplicationStatus, ReturnStatus, InvestigationStatus, CalibrationResult } from '../types';

export const roleLabels: Record<UserRole, string> = {
  technician: '机务员',
  admin: '工具管理员',
  quality: '质量员'
};

export const riskLevelLabels: Record<ToolRiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险'
};

export const riskLevelColors: Record<ToolRiskLevel, string> = {
  low: 'green',
  medium: 'orange',
  high: 'red'
};

export const toolStatusLabels: Record<string, string> = {
  available: '可用',
  borrowed: '已借出',
  maintenance: '维修中',
  calibrating: '校准中',
  scrapped: '已报废'
};

export const toolStatusColors: Record<string, string> = {
  available: 'green',
  borrowed: 'blue',
  maintenance: 'orange',
  calibrating: 'purple',
  scrapped: 'default'
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已审批',
  rejected: '已驳回',
  issued: '已发放',
  returned: '已归还',
  partial_returned: '部分归还'
};

export const applicationStatusColors: Record<ApplicationStatus, string> = {
  draft: 'default',
  pending_approval: 'orange',
  approved: 'green',
  rejected: 'red',
  issued: 'blue',
  returned: 'green',
  partial_returned: 'orange'
};

export const returnStatusLabels: Record<ReturnStatus, string> = {
  complete: '全部归还',
  partial: '部分归还',
  missing: '有缺件'
};

export const returnStatusColors: Record<ReturnStatus, string> = {
  complete: 'green',
  partial: 'orange',
  missing: 'red'
};

export const investigationStatusLabels: Record<InvestigationStatus, string> = {
  pending: '待处理',
  investigating: '调查中',
  quality_review: '待质量复核',
  closed: '已关闭'
};

export const investigationStatusColors: Record<InvestigationStatus, string> = {
  pending: 'red',
  investigating: 'orange',
  quality_review: 'purple',
  closed: 'green'
};

export const calibrationResultLabels: Record<CalibrationResult, string> = {
  pass: '合格',
  fail: '不合格',
  limited: '限用'
};

export const calibrationResultColors: Record<CalibrationResult, string> = {
  pass: 'green',
  fail: 'red',
  limited: 'orange'
};
