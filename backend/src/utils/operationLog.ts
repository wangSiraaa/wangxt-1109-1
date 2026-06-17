import { v4 as uuidv4 } from 'uuid';
import { prepare } from '../db';
import { JwtPayload, OperationLog } from '../types';

export function logOperation(
  operator: JwtPayload,
  operationType: string,
  options: {
    businessId?: string;
    businessNo?: string;
    shiftId?: string;
    detail?: string;
    result?: string;
  } = {}
): void {
  try {
    const { businessId, businessNo, shiftId, detail, result } = options;
    
    const logId = uuidv4();
    const now = new Date().toISOString();

    prepare(`
      INSERT INTO operation_logs (
        id, operation_type, business_id, business_no,
        operator_id, operator_name, operator_role, shift_id,
        detail, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      operationType,
      businessId || null,
      businessNo || null,
      operator.userId,
      operator.name,
      operator.role,
      shiftId || null,
      detail || null,
      result || null,
      now
    );
  } catch (error) {
    console.error('Failed to log operation:', error);
  }
}

export function getOperationLogs(
  options: {
    operationType?: string;
    businessId?: string;
    operatorId?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    pageSize?: number;
  } = {}
): { data: OperationLog[]; total: number } {
  const {
    operationType,
    businessId,
    operatorId,
    startTime,
    endTime,
    page = 1,
    pageSize = 20
  } = options;

  let sql = 'SELECT * FROM operation_logs WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM operation_logs WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (operationType) {
    sql += ' AND operation_type = ?';
    countSql += ' AND operation_type = ?';
    params.push(operationType);
    countParams.push(operationType);
  }

  if (businessId) {
    sql += ' AND business_id = ?';
    countSql += ' AND business_id = ?';
    params.push(businessId);
    countParams.push(businessId);
  }

  if (operatorId) {
    sql += ' AND operator_id = ?';
    countSql += ' AND operator_id = ?';
    params.push(operatorId);
    countParams.push(operatorId);
  }

  if (startTime) {
    sql += ' AND created_at >= ?';
    countSql += ' AND created_at >= ?';
    params.push(startTime);
    countParams.push(startTime);
  }

  if (endTime) {
    sql += ' AND created_at <= ?';
    countSql += ' AND created_at <= ?';
    params.push(endTime);
    countParams.push(endTime);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  params.push(limit, offset);

  const logs = prepare(sql).all(...params) as OperationLog[];
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  return {
    data: logs,
    total: totalResult.total
  };
}

export function getCurrentShiftId(): string | null {
  try {
    const result = prepare(`
      SELECT id FROM shifts 
      WHERE status = 'active' 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get() as { id: string } | undefined;
    return result?.id || null;
  } catch {
    return null;
  }
}
