export type UserRole = 'technician' | 'admin' | 'quality';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  phone?: string;
}

export type ToolRiskLevel = 'low' | 'medium' | 'high';
export type ToolStatus = 'available' | 'borrowed' | 'maintenance' | 'calibrating' | 'scrapped' | 'investigation_hold';

export type ShiftType = 'day' | 'night' | 'middle';
export type ShiftStatus = 'active' | 'ended';
export interface Shift {
  id: string;
  shift_name: string;
  shift_type: ShiftType;
  start_time: string;
  end_time: string;
  leader_id?: string;
  leader_name?: string;
  status: ShiftStatus;
  created_at: string;
  updated_at: string;
}

export type HandoverStatus = 'pending' | 'confirmed' | 'rejected';
export interface ShiftHandover {
  id: string;
  handover_no: string;
  from_shift_id: string;
  to_shift_id: string;
  from_user_id: string;
  from_user_name: string;
  to_user_id: string;
  to_user_name: string;
  handover_time: string;
  status: HandoverStatus;
  tool_snapshot?: string;
  remark?: string;
  confirmed_time?: string;
  created_at: string;
  updated_at: string;
  items?: ShiftHandoverItem[];
}

export interface ShiftHandoverItem {
  id: string;
  handover_id: string;
  item_type: 'borrowed_tool' | 'pending_investigation' | 'other';
  item_id?: string;
  item_name?: string;
  item_description?: string;
  status?: string;
}

export interface OperationLog {
  id: string;
  operation_type: string;
  business_id?: string;
  business_no?: string;
  operator_id: string;
  operator_name: string;
  operator_role: UserRole;
  shift_id?: string;
  detail?: string;
  result?: string;
  created_at: string;
}

export interface Tool {
  id: string;
  tool_code: string;
  tool_name: string;
  category?: string;
  specification?: string;
  risk_level: ToolRiskLevel;
  calibration_date?: string;
  calibration_expiry_date?: string;
  status: ToolStatus;
  location?: string;
  quantity: number;
  description?: string;
  is_calibration_expired?: boolean;
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'issued' | 'returned' | 'partial_returned';

export interface BorrowApplication {
  id: string;
  application_no: string;
  applicant_id: string;
  applicant_name: string;
  work_order_no?: string;
  work_type?: string;
  risk_level?: ToolRiskLevel;
  purpose?: string;
  expected_return_date?: string;
  status: ApplicationStatus;
  second_confirmer_id?: string;
  second_confirmer_name?: string;
  second_confirm_time?: string;
  quality_confirmer_id?: string;
  quality_confirmer_name?: string;
  quality_confirm_time?: string;
  approver_id?: string;
  approver_name?: string;
  approve_time?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
  items?: BorrowApplicationItem[];
}

export interface BorrowApplicationItem {
  id: string;
  application_id: string;
  tool_id: string;
  tool_code: string;
  tool_name: string;
  specification?: string;
  apply_quantity: number;
  actual_quantity: number;
  calibration_verified: number;
  calibration_remark?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
}

export type ReturnStatus = 'complete' | 'partial' | 'missing';
export type ReturnItemStatus = 'returned' | 'missing' | 'damaged';

export interface ReturnRecord {
  id: string;
  application_id: string;
  application_no: string;
  returner_id: string;
  returner_name: string;
  receiver_id?: string;
  receiver_name?: string;
  return_time: string;
  status: ReturnStatus;
  remark?: string;
  items?: ReturnItem[];
}

export interface ReturnItem {
  id: string;
  return_record_id: string;
  tool_id: string;
  tool_code: string;
  tool_name: string;
  borrow_quantity: number;
  return_quantity: number;
  missing_quantity: number;
  status: ReturnItemStatus;
  remark?: string;
}

export type InvestigationStatus = 'pending' | 'investigating' | 'quality_review' | 'closed';

export interface InvestigationReport {
  id: string;
  report_no: string;
  application_id: string;
  application_no: string;
  return_record_id: string;
  shift_id?: string;
  handover_id?: string;
  reporter_id: string;
  reporter_name: string;
  report_time: string;
  status: InvestigationStatus;
  missing_tools: string;
  incident_description?: string;
  investigation_result?: string;
  handler_id?: string;
  handler_name?: string;
  handle_time?: string;
  handle_remark?: string;
  quality_reviewer_id?: string;
  quality_reviewer_name?: string;
  quality_review_time?: string;
  quality_review_remark?: string;
  created_at: string;
  updated_at: string;
}

export type CalibrationResult = 'pass' | 'fail' | 'limited';

export interface CalibrationRecord {
  id: string;
  tool_id: string;
  tool_code: string;
  tool_name: string;
  calibrator_id: string;
  calibrator_name: string;
  calibration_date: string;
  calibration_expiry_date?: string;
  calibration_result: CalibrationResult;
  calibration_certificate_no?: string;
  remark?: string;
  created_at: string;
}

export interface DashboardStats {
  tools: {
    total: number;
    available: number;
    borrowed: number;
    calibration_expired: number;
  };
  applications: {
    pending_approval: number;
    pending_issue: number;
    borrowed: number;
  };
  investigation: {
    pending: number;
  };
  recent_applications: BorrowApplication[];
}
