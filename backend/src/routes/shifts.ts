import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prepare } from '../db';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { Shift, ShiftType, Tool, BorrowApplication, BorrowApplicationItem } from '../types';
import { logOperation, getCurrentShiftId } from '../utils/operationLog';

const router = Router();

function generateHandoverNo(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
    (now.getMonth() + 1).toString().padStart(2, '0') + 
    now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `JJ${dateStr}${random}`;
}

router.get('/current', authMiddleware, (req: Request, res: Response) => {
  const shift = prepare(`
    SELECT * FROM shifts 
    WHERE status = 'active' 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get() as Shift | undefined;

  res.json({
    success: true,
    data: shift || null
  });
});

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const { status, page = 1, pageSize = 20 } = req.query;

  let sql = 'SELECT * FROM shifts WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM shifts WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (status) {
    sql += ' AND status = ?';
    countSql += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const shifts = prepare(sql).all(...params) as Shift[];
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  res.json({
    success: true,
    data: shifts,
    total: totalResult.total
  });
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  
  const shift = prepare('SELECT * FROM shifts WHERE id = ?').get(id) as Shift | undefined;
  
  if (!shift) {
    return res.json({ success: false, message: '班次不存在' });
  }

  res.json({ success: true, data: shift });
});

router.post('/', authMiddleware, roleMiddleware('admin', 'technician'), (req: Request, res: Response) => {
  const {
    shift_name,
    shift_type = 'day',
    start_time,
    end_time,
    leader_id,
    leader_name
  } = req.body;

  if (!shift_name || !start_time || !end_time) {
    return res.json({ success: false, message: '请填写必要信息' });
  }

  const activeShift = prepare(`
    SELECT * FROM shifts WHERE status = 'active' LIMIT 1
  `).get() as Shift | undefined;

  if (activeShift) {
    return res.json({ 
      success: false, 
      message: `当前已有活动班次：${activeShift.shift_name}，请先结束当前班次` 
    });
  }

  const shiftId = uuidv4();

  prepare(`
    INSERT INTO shifts (
      id, shift_name, shift_type, start_time, end_time,
      leader_id, leader_name, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(
    shiftId,
    shift_name,
    shift_type as ShiftType,
    start_time,
    end_time,
    leader_id || req.user!.userId,
    leader_name || req.user!.name
  );

  logOperation(req.user!, 'create_shift', {
    businessId: shiftId,
    businessNo: shift_name,
    shiftId: shiftId,
    detail: `创建班次：${shift_name}`
  });

  res.json({ 
    success: true, 
    message: '班次创建成功',
    data: { id: shiftId, shift_name }
  });
});

router.post('/:id/end', authMiddleware, roleMiddleware('admin', 'technician'), (req: Request, res: Response) => {
  const { id } = req.params;

  const shift = prepare('SELECT * FROM shifts WHERE id = ?').get(id) as Shift | undefined;
  
  if (!shift) {
    return res.json({ success: false, message: '班次不存在' });
  }

  if (shift.status !== 'active') {
    return res.json({ success: false, message: '仅活动班次可结束' });
  }

  const borrowedTools = prepare(`
    SELECT DISTINCT t.*, ba.application_no, ba.applicant_name
    FROM tools t
    INNER JOIN borrow_application_items bai ON t.id = bai.tool_id
    INNER JOIN borrow_applications ba ON bai.application_id = ba.id
    WHERE ba.status = 'issued' AND t.status = 'borrowed'
  `).all() as (Tool & { application_no: string; applicant_name: string })[];

  if (borrowedTools.length > 0) {
    return res.json({
      success: false,
      message: `还有 ${borrowedTools.length} 件工具未归还，请先完成归还后再结束班次`,
      data: { borrowed_tools: borrowedTools }
    });
  }

  const pendingInvestigations = prepare(`
    SELECT COUNT(*) as count 
    FROM investigation_reports 
    WHERE status IN ('pending', 'investigating', 'quality_review')
  `).get() as { count: number };

  if (pendingInvestigations.count > 0) {
    return res.json({
      success: false,
      message: `还有 ${pendingInvestigations.count} 个调查单未处理完成，请先处理后再结束班次`
    });
  }

  prepare(`
    UPDATE shifts SET 
      status = 'ended',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  logOperation(req.user!, 'end_shift', {
    businessId: id,
    businessNo: shift.shift_name,
    shiftId: id,
    detail: `结束班次：${shift.shift_name}`
  });

  res.json({ success: true, message: '班次已结束' });
});

router.get('/:id/handover-pending', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;

  const borrowedTools = prepare(`
    SELECT DISTINCT t.*, 
           bai.apply_quantity, 
           bai.actual_quantity,
           ba.application_no, 
           ba.applicant_name,
           ba.id as application_id
    FROM tools t
    INNER JOIN borrow_application_items bai ON t.id = bai.tool_id
    INNER JOIN borrow_applications ba ON bai.application_id = ba.id
    WHERE ba.status = 'issued' AND t.status = 'borrowed'
  `).all() as (Tool & { 
    apply_quantity: number; 
    actual_quantity: number;
    application_no: string; 
    applicant_name: string;
    application_id: string;
  })[];

  const pendingInvestigations = prepare(`
    SELECT ir.*, sr.application_no, sr.return_time
    FROM investigation_reports ir
    INNER JOIN return_records sr ON ir.return_record_id = sr.id
    WHERE ir.status IN ('pending', 'investigating', 'quality_review')
  `).all();

  res.json({
    success: true,
    data: {
      borrowed_tools: borrowedTools,
      pending_investigations: pendingInvestigations
    }
  });
});

router.post('/handover', authMiddleware, roleMiddleware('admin', 'technician'), (req: Request, res: Response) => {
  const {
    to_shift_id,
    to_user_id,
    to_user_name,
    remark
  } = req.body;

  if (!to_shift_id || !to_user_id || !to_user_name) {
    return res.json({ success: false, message: '请填写交接信息' });
  }

  const currentShift = prepare(`
    SELECT * FROM shifts WHERE status = 'active' ORDER BY created_at DESC LIMIT 1
  `).get() as Shift | undefined;

  if (!currentShift) {
    return res.json({ success: false, message: '当前没有活动班次' });
  }

  if (currentShift.leader_id === to_user_id) {
    return res.json({ success: false, message: '不能交接给自己' });
  }

  const borrowedTools = prepare(`
    SELECT DISTINCT t.*, 
           COALESCE(bai.actual_quantity, bai.apply_quantity) as borrow_quantity,
           ba.application_no
    FROM tools t
    INNER JOIN borrow_application_items bai ON t.id = bai.tool_id
    INNER JOIN borrow_applications ba ON bai.application_id = ba.id
    WHERE ba.status = 'issued' AND t.status = 'borrowed'
  `).all() as (Tool & { borrow_quantity: number; application_no: string })[];

  const pendingInvestigations = prepare(`
    SELECT ir.*, sr.application_no
    FROM investigation_reports ir
    INNER JOIN return_records sr ON ir.return_record_id = sr.id
    WHERE ir.status IN ('pending', 'investigating', 'quality_review')
  `).all() as any[];

  const handoverId = uuidv4();
  const handoverNo = generateHandoverNo();
  const handoverTime = new Date().toISOString();

  const toolSnapshot = JSON.stringify({
    borrowed_tools: borrowedTools,
    pending_investigations: pendingInvestigations,
    handover_time: handoverTime
  });

  prepare(`
    INSERT INTO shift_handovers (
      id, handover_no, from_shift_id, to_shift_id,
      from_user_id, from_user_name, to_user_id, to_user_name,
      handover_time, status, tool_snapshot, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    handoverId,
    handoverNo,
    currentShift.id,
    to_shift_id,
    req.user!.userId,
    req.user!.name,
    to_user_id,
    to_user_name,
    handoverTime,
    toolSnapshot,
    remark || null
  );

  const insertItem = prepare(`
    INSERT INTO shift_handover_items (
      id, handover_id, tool_id, tool_code, tool_name,
      quantity, status, investigation_id, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const tool of borrowedTools) {
    insertItem.run(
      uuidv4(),
      handoverId,
      tool.id,
      tool.tool_code,
      tool.tool_name,
      tool.borrow_quantity,
      'normal',
      null,
      `借用单：${tool.application_no}`
    );
  }

  for (const inv of pendingInvestigations) {
    const items = prepare(`
      SELECT ri.tool_id, ri.tool_code, ri.tool_name, ri.missing_quantity
      FROM return_items ri
      WHERE ri.return_record_id = ? AND ri.status = 'missing'
    `).all(inv.return_record_id) as any[];

    for (const item of items) {
      insertItem.run(
        uuidv4(),
        handoverId,
        item.tool_id,
        item.tool_code,
        item.tool_name,
        item.missing_quantity,
        'investigation_hold',
        inv.id,
        `调查单：${inv.report_no}`
      );
    }
  }

  logOperation(req.user!, 'create_handover', {
    businessId: handoverId,
    businessNo: handoverNo,
    shiftId: currentShift.id,
    detail: `创建交接单：${handoverNo}，交接给：${to_user_name}`
  });

  res.json({
    success: true,
    message: '交接单创建成功',
    data: { id: handoverId, handover_no: handoverNo }
  });
});

router.get('/handover/pending', authMiddleware, (req: Request, res: Response) => {
  const { page = 1, pageSize = 20 } = req.query;

  let sql = `
    SELECT sh.*, 
           fs.shift_name as from_shift_name,
           ts.shift_name as to_shift_name
    FROM shift_handovers sh
    LEFT JOIN shifts fs ON sh.from_shift_id = fs.id
    LEFT JOIN shifts ts ON sh.to_shift_id = ts.id
    WHERE sh.status = 'pending'
  `;
  let countSql = `
    SELECT COUNT(*) as total FROM shift_handovers 
    WHERE status = 'pending'
  `;
  const params: any[] = [];
  const countParams: any[] = [];

  if (req.user?.role === 'technician') {
    sql += ' AND sh.to_user_id = ?';
    countSql += ' AND to_user_id = ?';
    params.push(req.user.userId);
    countParams.push(req.user.userId);
  }

  sql += ' ORDER BY sh.handover_time DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const handovers = prepare(sql).all(...params);
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  res.json({
    success: true,
    data: handovers,
    total: totalResult.total
  });
});

router.get('/handover/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;

  const handover = prepare(`
    SELECT sh.*, 
           fs.shift_name as from_shift_name,
           ts.shift_name as to_shift_name
    FROM shift_handovers sh
    LEFT JOIN shifts fs ON sh.from_shift_id = fs.id
    LEFT JOIN shifts ts ON sh.to_shift_id = ts.id
    WHERE sh.id = ?
  `).get(id) as any;

  if (!handover) {
    return res.json({ success: false, message: '交接单不存在' });
  }

  const items = prepare(`
    SELECT shi.*, ir.report_no, ir.status as investigation_status
    FROM shift_handover_items shi
    LEFT JOIN investigation_reports ir ON shi.investigation_id = ir.id
    WHERE shi.handover_id = ?
  `).all(id);

  res.json({
    success: true,
    data: {
      ...handover,
      items
    }
  });
});

router.post('/handover/:id/confirm', authMiddleware, roleMiddleware('admin', 'technician'), (req: Request, res: Response) => {
  const { id } = req.params;

  const handover = prepare('SELECT * FROM shift_handovers WHERE id = ?').get(id) as any;

  if (!handover) {
    return res.json({ success: false, message: '交接单不存在' });
  }

  if (handover.status !== 'pending') {
    return res.json({ success: false, message: '交接单已处理' });
  }

  if (handover.to_user_id !== req.user!.userId) {
    return res.json({ success: false, message: '只能确认交接给自己的交接单' });
  }

  const now = new Date().toISOString();

  prepare(`
    UPDATE shift_handovers SET
      status = 'confirmed',
      confirmed_time = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(now, id);

  prepare(`
    UPDATE shifts SET
      leader_id = ?,
      leader_name = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user!.userId, req.user!.name, handover.to_shift_id);

  const items = prepare('SELECT * FROM shift_handover_items WHERE handover_id = ?').all(id) as any[];
  const investigationIds = [...new Set(items.filter(i => i.investigation_id).map(i => i.investigation_id))];

  for (const invId of investigationIds) {
    if (invId) {
      prepare(`
        UPDATE investigation_reports SET
          handover_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id, invId);
    }
  }

  logOperation(req.user!, 'confirm_handover', {
    businessId: id,
    businessNo: handover.handover_no,
    shiftId: handover.to_shift_id,
    detail: `确认交接单：${handover.handover_no}`
  });

  res.json({ success: true, message: '交接确认成功' });
});

router.post('/handover/:id/reject', authMiddleware, roleMiddleware('admin', 'technician'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { remark } = req.body;

  const handover = prepare('SELECT * FROM shift_handovers WHERE id = ?').get(id) as any;

  if (!handover) {
    return res.json({ success: false, message: '交接单不存在' });
  }

  if (handover.status !== 'pending') {
    return res.json({ success: false, message: '交接单已处理' });
  }

  if (handover.to_user_id !== req.user!.userId) {
    return res.json({ success: false, message: '只能拒绝交接给自己的交接单' });
  }

  prepare(`
    UPDATE shift_handovers SET
      status = 'rejected',
      remark = COALESCE(?, remark),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(remark || null, id);

  logOperation(req.user!, 'reject_handover', {
    businessId: id,
    businessNo: handover.handover_no,
    shiftId: handover.to_shift_id,
    detail: `拒绝交接单：${handover.handover_no}，原因：${remark || '未说明'}`
  });

  res.json({ success: true, message: '交接已拒绝' });
});

router.get('/handover/list', authMiddleware, (req: Request, res: Response) => {
  const { status, page = 1, pageSize = 20 } = req.query;

  let sql = `
    SELECT sh.*, 
           fs.shift_name as from_shift_name,
           ts.shift_name as to_shift_name
    FROM shift_handovers sh
    LEFT JOIN shifts fs ON sh.from_shift_id = fs.id
    LEFT JOIN shifts ts ON sh.to_shift_id = ts.id
    WHERE 1=1
  `;
  let countSql = 'SELECT COUNT(*) as total FROM shift_handovers WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (status) {
    sql += ' AND sh.status = ?';
    countSql += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  sql += ' ORDER BY sh.handover_time DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const handovers = prepare(sql).all(...params);
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  res.json({
    success: true,
    data: handovers,
    total: totalResult.total
  });
});

router.get('/logs', authMiddleware, (req: Request, res: Response) => {
  const { operation_type, business_id, operator_id, start_time, end_time, page = 1, pageSize = 20 } = req.query;

  const result = getOperationLogs({
    operationType: operation_type as string,
    businessId: business_id as string,
    operatorId: operator_id as string,
    startTime: start_time as string,
    endTime: end_time as string,
    page: parseInt(page as string),
    pageSize: parseInt(pageSize as string)
  });

  res.json({
    success: true,
    data: result.data,
    total: result.total
  });
});

export default router;
