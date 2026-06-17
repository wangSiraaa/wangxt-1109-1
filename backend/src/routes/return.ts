import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prepare } from '../db';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { 
  BorrowApplication, 
  BorrowApplicationItem, 
  ReturnRecord, 
  ReturnItem,
  InvestigationReport,
  Tool,
  InvestigationStatus,
  ToolStatus 
} from '../types';
import { logOperation, getCurrentShiftId } from '../utils/operationLog';

const router = Router();

function generateReportNo(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
    (now.getMonth() + 1).toString().padStart(2, '0') + 
    now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DC${dateStr}${random}`;
}

router.get('/borrowed', authMiddleware, roleMiddleware('admin', 'technician'), (req: Request, res: Response) => {
  const { applicant_id, page = 1, pageSize = 20 } = req.query;

  let sql = `SELECT ba.* FROM borrow_applications ba 
             WHERE ba.status = 'issued'`;
  let countSql = `SELECT COUNT(*) as total FROM borrow_applications ba 
                  WHERE ba.status = 'issued'`;
  const params: any[] = [];
  const countParams: any[] = [];

  if (applicant_id) {
    sql += ' AND ba.applicant_id = ?';
    countSql += ' AND ba.applicant_id = ?';
    params.push(applicant_id);
    countParams.push(applicant_id);
  }

  if (req.user?.role === 'technician') {
    sql += ' AND ba.applicant_id = ?';
    countSql += ' AND ba.applicant_id = ?';
    params.push(req.user.userId);
    countParams.push(req.user.userId);
  }

  sql += ' ORDER BY ba.created_at DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const applications = prepare(sql).all(...params) as BorrowApplication[];
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  res.json({
    success: true,
    data: applications,
    total: totalResult.total || 0
  });
});

router.post('/return/:applicationId', authMiddleware, roleMiddleware('technician', 'admin'), (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const { returnItems = [], remark } = req.body;

  const application = prepare('SELECT * FROM borrow_applications WHERE id = ?').get(applicationId) as BorrowApplication | undefined;
  
  if (!application) {
    return res.json({ success: false, message: '申请单不存在' });
  }

  if (application.status !== 'issued') {
    return res.json({ success: false, message: '仅已发放状态可归还' });
  }

  if (req.user?.role === 'technician' && application.applicant_id !== req.user.userId) {
    return res.json({ success: false, message: '只能归还自己的借用' });
  }

  const appItems = prepare('SELECT * FROM borrow_application_items WHERE application_id = ?').all(applicationId) as BorrowApplicationItem[];

  const returnId = uuidv4();
  const returnTime = new Date().toISOString();

  let hasMissing = false;
  let allReturned = true;
  const missingTools: string[] = [];

  for (const appItem of appItems) {
    const returnItem = returnItems.find((ri: any) => ri.tool_id === appItem.tool_id);
    const actualQty = appItem.actual_quantity || appItem.apply_quantity;
    
    if (returnItem) {
      const returnQty = returnItem.return_quantity || 0;
      const missingQty = actualQty - returnQty;
      
      if (missingQty > 0) {
        hasMissing = true;
        allReturned = false;
        missingTools.push(`${appItem.tool_name} x${missingQty}`);
      } else if (returnQty < actualQty) {
        allReturned = false;
      }
    } else {
      hasMissing = true;
      allReturned = false;
      missingTools.push(`${appItem.tool_name} x${actualQty}`);
    }
  }

  const returnStatus = hasMissing ? 'missing' : (allReturned ? 'complete' : 'partial');

  prepare(`
    INSERT INTO return_records (
      id, application_id, application_no, returner_id, returner_name,
      receiver_id, receiver_name, return_time, status, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    returnId,
    applicationId,
    application.application_no,
    req.user!.userId,
    req.user!.name,
    req.user!.role === 'admin' ? req.user!.userId : null,
    req.user!.role === 'admin' ? req.user!.name : null,
    returnTime,
    returnStatus,
    remark || null
  );

  const insertReturnItem = prepare(`
    INSERT INTO return_items (
      id, return_record_id, tool_id, tool_code, tool_name,
      borrow_quantity, return_quantity, missing_quantity, status, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateToolStmt = prepare(`
    UPDATE tools SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  for (const appItem of appItems) {
    const returnItem = returnItems.find((ri: any) => ri.tool_id === appItem.tool_id);
    const actualQty = appItem.actual_quantity || appItem.apply_quantity;
    const returnQty = returnItem ? (returnItem.return_quantity || 0) : 0;
    const missingQty = actualQty - returnQty;
    const itemStatus = missingQty > 0 ? 'missing' : 'returned';

    insertReturnItem.run(
      uuidv4(),
      returnId,
      appItem.tool_id,
      appItem.tool_code,
      appItem.tool_name,
      actualQty,
      returnQty,
      missingQty,
      itemStatus,
      returnItem?.remark || null
    );

    if (returnQty > 0) {
      updateToolStmt.run(appItem.tool_id);
    }
  }

  const shiftId = getCurrentShiftId();
  
  let newStatus = 'returned';
  if (hasMissing) {
    newStatus = 'partial_returned';
    
    const reportId = uuidv4();
    const reportNo = generateReportNo();
    
    prepare(`
      INSERT INTO investigation_reports (
        id, report_no, application_id, application_no, return_record_id, shift_id,
        reporter_id, reporter_name, report_time, status, missing_tools, incident_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      reportId,
      reportNo,
      applicationId,
      application.application_no,
      returnId,
      shiftId,
      req.user!.userId,
      req.user!.name,
      returnTime,
      missingTools.join(', '),
      `工具归还时发现缺件，涉及工具：${missingTools.join(', ')}`
    );

    logOperation(req.user!, 'create_investigation_report', {
      businessId: reportId,
      businessNo: reportNo,
      shiftId: shiftId || undefined,
      detail: `生成缺件调查单：${reportNo}，关联申请单：${application.application_no}`
    });

    const missingToolIds = returnItems
      .filter((item: any) => (item.missing_quantity || 0) > 0 || (item.return_quantity || 0) === 0)
      .map((item: any) => item.tool_id);
    
    if (missingToolIds.length > 0) {
      const placeholders = missingToolIds.map(() => '?').join(',');
      prepare(`UPDATE tools SET status = 'investigation_hold', updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`)
        .run(...missingToolIds);
    }

    logOperation(req.user!, 'return_tools_missing', {
      businessId: returnId,
      businessNo: application.application_no,
      shiftId: shiftId || undefined,
      detail: `归还工具缺件，申请单：${application.application_no}，缺件工具：${missingTools.join(', ')}`
    });
  } else {
    logOperation(req.user!, 'return_tools', {
      businessId: returnId,
      businessNo: application.application_no,
      shiftId: shiftId || undefined,
      detail: `归还工具完成：${application.application_no}，共${returnItems.length}件`
    });
  }

  prepare(`
    UPDATE borrow_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(newStatus, applicationId);

  res.json({ 
    success: true, 
    message: hasMissing ? '归还成功，已生成缺件调查单' : '归还成功',
    data: { 
      return_id: returnId,
      has_missing: hasMissing
    }
  });
});

router.get('/records', authMiddleware, (req: Request, res: Response) => {
  const { application_id, status, page = 1, pageSize = 20 } = req.query;

  let sql = 'SELECT * FROM return_records WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM return_records WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (application_id) {
    sql += ' AND application_id = ?';
    countSql += ' AND application_id = ?';
    params.push(application_id);
    countParams.push(application_id);
  }

  if (status) {
    sql += ' AND status = ?';
    countSql += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  sql += ' ORDER BY return_time DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const records = prepare(sql).all(...params) as ReturnRecord[];
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  res.json({
    success: true,
    data: records,
    total: totalResult.total
  });
});

router.get('/records/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;

  const record = prepare('SELECT * FROM return_records WHERE id = ?').get(id) as ReturnRecord | undefined;
  
  if (!record) {
    return res.json({ success: false, message: '归还记录不存在' });
  }

  const items = prepare('SELECT * FROM return_items WHERE return_record_id = ?').all(id) as ReturnItem[];

  res.json({
    success: true,
    data: {
      ...record,
      items
    }
  });
});

export default router;
