import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prepare } from '../db';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { BorrowApplication, BorrowApplicationItem, IssueRecord, Tool } from '../types';
import { logOperation, getCurrentShiftId } from '../utils/operationLog';

const router = Router();

router.get('/pending', authMiddleware, roleMiddleware('admin', 'quality'), (req: Request, res: Response) => {
  const { page = 1, pageSize = 20 } = req.query;

  let sql: string;
  let countSql: string;
  const params: any[] = [];
  const countParams: any[] = [];

  if (req.user?.role === 'quality') {
    sql = `SELECT * FROM borrow_applications 
           WHERE status = 'approved' 
             AND quality_confirmer_id IS NULL
             AND (risk_level != 'high' OR second_confirmer_id IS NOT NULL)`;
    countSql = `SELECT COUNT(*) as total FROM borrow_applications 
                WHERE status = 'approved' 
                  AND quality_confirmer_id IS NULL
                  AND (risk_level != 'high' OR second_confirmer_id IS NOT NULL)`;
  } else {
    sql = `SELECT * FROM borrow_applications 
           WHERE status = 'approved' 
             AND quality_confirmer_id IS NOT NULL
             AND (risk_level != 'high' OR second_confirmer_id IS NOT NULL)`;
    countSql = `SELECT COUNT(*) as total FROM borrow_applications 
                WHERE status = 'approved' 
                  AND quality_confirmer_id IS NOT NULL
                  AND (risk_level != 'high' OR second_confirmer_id IS NOT NULL)`;
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const applications = prepare(sql).all(...params) as BorrowApplication[];
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  const appsWithItems = applications.map(app => {
    const items = prepare('SELECT * FROM borrow_application_items WHERE application_id = ?').all(app.id) as BorrowApplicationItem[];
    return { ...app, items };
  });

  res.json({
    success: true,
    data: appsWithItems,
    total: totalResult.total || 0
  });
});

router.post('/quality-confirm/:applicationId', authMiddleware, roleMiddleware('quality'), (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const { itemResults = [], remark } = req.body;

  const application = prepare('SELECT * FROM borrow_applications WHERE id = ?').get(applicationId) as BorrowApplication | undefined;
  
  if (!application) {
    return res.json({ success: false, message: '申请单不存在' });
  }

  if (application.status !== 'approved') {
    return res.json({ success: false, message: '仅已审批状态可校准确认' });
  }

  if (application.quality_confirmer_id) {
    return res.json({ success: false, message: '已完成校准确认' });
  }

  const items = prepare('SELECT * FROM borrow_application_items WHERE application_id = ?').all(applicationId) as BorrowApplicationItem[];

  const today = new Date().toISOString().split('T')[0];
  let hasExpired = false;

  for (const item of items) {
    const tool = prepare('SELECT * FROM tools WHERE id = ?').get(item.tool_id) as Tool | undefined;
    
    if (tool && tool.calibration_expiry_date && tool.calibration_expiry_date < today) {
      hasExpired = true;
    }

    const itemResult = itemResults.find((r: any) => r.tool_id === item.tool_id);
    if (itemResult) {
      prepare(`
        UPDATE borrow_application_items SET
          calibration_verified = ?,
          calibration_remark = ?
        WHERE id = ?
      `).run(
        itemResult.verified ? 1 : 0,
        itemResult.remark || null,
        item.id
      );
    }
  }

  if (hasExpired) {
    return res.json({ 
      success: false, 
      message: '存在校准过期的工具，不能通过校准确认，请更换工具后重试' 
    });
  }

  prepare(`
    UPDATE borrow_applications SET
      quality_confirmer_id = ?,
      quality_confirmer_name = ?,
      quality_confirm_time = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user!.userId, req.user!.name, applicationId);

  logOperation(req.user!, 'quality_confirm_calibration', {
    businessId: applicationId,
    businessNo: application.application_no,
    shiftId: application.shift_id || undefined,
    detail: `质量员校准确认完成：${application.application_no}，共${items.length}件工具`
  });

  res.json({ success: true, message: '校准确认完成' });
});

router.post('/issue/:applicationId', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { applicationId } = req.params;
  const { actualItems = [], remark } = req.body;

  const application = prepare('SELECT * FROM borrow_applications WHERE id = ?').get(applicationId) as BorrowApplication | undefined;
  
  if (!application) {
    return res.json({ success: false, message: '申请单不存在' });
  }

  if (application.status !== 'approved') {
    return res.json({ success: false, message: '仅已审批状态可发放' });
  }

  if (application.risk_level === 'high' && !application.second_confirmer_id) {
    return res.json({ success: false, message: '高风险维修需要双人确认后才能发放' });
  }

  if (!application.quality_confirmer_id) {
    return res.json({ success: false, message: '需要质量员校准确认后才能发放' });
  }

  const today = new Date().toISOString().split('T')[0];
  const items = prepare('SELECT * FROM borrow_application_items WHERE application_id = ?').all(applicationId) as BorrowApplicationItem[];

  for (const item of items) {
    const tool = prepare('SELECT * FROM tools WHERE id = ?').get(item.tool_id) as Tool | undefined;
    
    if (tool && tool.calibration_expiry_date && tool.calibration_expiry_date < today) {
      return res.json({ 
        success: false, 
        message: `工具 ${tool.tool_name} (${tool.tool_code}) 校准已过期，不能借出` 
      });
    }
  }

  const issueId = uuidv4();
  const issueTime = new Date().toISOString();

  prepare(`
    INSERT INTO issue_records (id, application_id, application_no, issuer_id, issuer_name, issue_time, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    issueId,
    applicationId,
    application.application_no,
    req.user!.userId,
    req.user!.name,
    issueTime,
    remark || null
  );

  const updateItemStmt = prepare(`
    UPDATE borrow_application_items SET actual_quantity = ? WHERE id = ?
  `);

  const updateToolStmt = prepare(`
    UPDATE tools SET status = 'borrowed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  for (const actualItem of actualItems) {
    const appItem = items.find(i => i.tool_id === actualItem.tool_id);
    if (appItem) {
      updateItemStmt.run(actualItem.actual_quantity || appItem.apply_quantity, appItem.id);
      
      const tool = prepare('SELECT * FROM tools WHERE id = ?').get(actualItem.tool_id) as Tool | undefined;
      if (tool && tool.status === 'available') {
        updateToolStmt.run(actualItem.tool_id);
      }
    }
  }

  prepare(`
    UPDATE borrow_applications SET status = 'issued', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(applicationId);

  logOperation(req.user!, 'issue_tools', {
    businessId: applicationId,
    businessNo: application.application_no,
    shiftId: application.shift_id || undefined,
    detail: `工具发放完成：${application.application_no}，共${actualItems.length}件工具`
  });

  res.json({ success: true, message: '发放成功', data: { issue_id: issueId } });
});

router.get('/records', authMiddleware, (req: Request, res: Response) => {
  const { application_id, page = 1, pageSize = 20 } = req.query;

  let sql = 'SELECT * FROM issue_records WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM issue_records WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (application_id) {
    sql += ' AND application_id = ?';
    countSql += ' AND application_id = ?';
    params.push(application_id);
    countParams.push(application_id);
  }

  sql += ' ORDER BY issue_time DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const records = prepare(sql).all(...params) as IssueRecord[];
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  res.json({
    success: true,
    data: records,
    total: totalResult.total
  });
});

export default router;
