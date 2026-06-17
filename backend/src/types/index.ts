export type UserRole = 'technician' | 'admin' | 'quality';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  created_at: string;
  updated_at: string;
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

export type HandoverItemStatus = 'normal' | 'missing' | 'damaged' | 'investigation_hold';

export interface ShiftHandoverItem {
  id: string;
  handover_id: string;
  tool_id: string;
  tool_code: string;
  tool_name: string;
  quantity: number;
  status: HandoverItemStatus;
  investigation_id?: string;
  remark?: string;
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

export type InvestigationStatus = 'pending' | 'investigating' | 'quality_review' | 'closed';

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
  shift_id?: string;
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

export interface IssueRecord {
  id: string;
  application_id: string;
  application_no: string;
  issuer_id: string;
  issuer_name: string;
  issue_time: string;
  remark?: string;
}

export type ReturnStatus = 'complete' | 'partial' | 'missing';

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
}

export type ReturnItemStatus = 'returned' | 'missing' | 'damaged';

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

export interface InvestigationReport {
  id: string;
  report_no: string;
  application_id: string;
  application_no: string;
  return_record_id: string;
  shift_id?: string;
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

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
  name: string;
}
