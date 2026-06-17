import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prepare } from '../db';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { BorrowApplication, BorrowApplicationItem, Tool } from '../types';

const router = Router();

function generateApplicationNo(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
    (now.getMonth() + 1).toString().padStart(2, '0') + 
    now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `JY${dateStr}${random}`;
}

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const { 
    status, 
    applicant_id, 
    risk_level,
    keyword,
    page = 1, 
    pageSize = 20 
  } = req.query;

  let sql = 'SELECT * FROM borrow_applications WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM borrow_applications WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (status) {
    sql += ' AND status = ?';
    countSql += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  if (applicant_id) {
    sql += ' AND applicant_id = ?';
    countSql += ' AND applicant_id = ?';
    params.push(applicant_id);
    countParams.push(applicant_id);
  }

  if (risk_level) {
    sql += ' AND risk_level = ?';
    countSql += ' AND risk_level = ?';
    params.push(risk_level);
    countParams.push(risk_level);
  }

  if (keyword) {
    sql += ' AND (application_no LIKE ? OR work_order_no LIKE ? OR purpose LIKE ?)';
    countSql += ' AND (application_no LIKE ? OR work_order_no LIKE ? OR purpose LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
    countParams.push(kw, kw, kw);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const applications = prepare(sql).all(...params) as BorrowApplication[];
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  res.json({
    success: true,
    data: applications,
    total: totalResult.total
  });
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  
  const application = prepare('SELECT * FROM borrow_applications WHERE id = ?').get(id) as BorrowApplication | undefined;
  
  if (!application) {
    return res.json({ success: false, message: '申请单不存在' });
  }

  const items = prepare('SELECT * FROM borrow_application_items WHERE application_id = ?').all(id) as BorrowApplicationItem[];

  res.json({
    success: true,
    data: {
      ...application,
      items
    }
  });
});

router.post('/', authMiddleware, roleMiddleware('technician'), (req: Request, res: Response) => {
  const {
    work_order_no,
    work_type,
    risk_level,
    purpose,
    expected_return_date,
    remark,
    items = []
  } = req.body;

  if (!req.user) {
    return res.json({ success: false, message: '未认证' });
  }

  if (!items || items.length === 0) {
    return res.json({ success: false, message: '请至少选择一个工具' });
  }

  const applicationId = uuidv4();
  const applicationNo = generateApplicationNo();

  const insertApplication = prepare(`
    INSERT INTO borrow_applications (
      id, application_no, applicant_id, applicant_name,
      work_order_no, work_type, risk_level, purpose,
      expected_return_date, status, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
  `);

  insertApplication.run(
    applicationId,
    applicationNo,
    req.user.userId,
    req.user.name,
    work_order_no || null,
    work_type || null,
    risk_level || null,
    purpose || null,
    expected_return_date || null,
    remark || null
  );

  const insertItem = prepare(`
    INSERT INTO borrow_application_items (
      id, application_id, tool_id, tool_code, tool_name,
      specification, apply_quantity, actual_quantity, calibration_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
  `);

  for (const item of items) {
    const tool = prepare('SELECT * FROM tools WHERE id = ?').get(item.tool_id) as Tool | undefined;
    if (!tool) continue;

    insertItem.run(
      uuidv4(),
      applicationId,
      tool.id,
      tool.tool_code,
      tool.tool_name,
      tool.specification || null,
      item.apply_quantity || 1
    );
  }

  res.json({
    success: true,
    data: { id: applicationId, application_no: applicationNo }
  });
});

router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    work_order_no,
    work_type,
    risk_level,
    purpose,
    expected_return_date,
    remark,
    items
  } = req.body;

  const application = prepare('SELECT * FROM borrow_applications WHERE id = ?').get(id) as BorrowApplication | undefined;
  
  if (!application) {
    return res.json({ success: false, message: '申请单不存在' });
  }

  if (application.status !== 'draft') {
    return res.json({ success: false, message: '仅草稿状态可修改' });
  }

  if (req.user?.role === 'technician' && application.applicant_id !== req.user.userId) {
    return res.json({ success: false, message: '只能修改自己的申请单' });
  }

  prepare(`
    UPDATE borrow_applications SET
      work_order_no = COALESCE(?, work_order_no),
      work_type = COALESCE(?, work_type),
      risk_level = COALESCE(?, risk_level),
      purpose = COALESCE(?, purpose),
      expected_return_date = COALESCE(?, expected_return_date),
      remark = COALESCE(?, remark),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    work_order_no !== undefined ? work_order_no : null,
    work_type !== undefined ? work_type : null,
    risk_level !== undefined ? risk_level : null,
    purpose !== undefined ? purpose : null,
    expected_return_date !== undefined ? expected_return_date : null,
    remark !== undefined ? remark : null,
    id
  );

  if (items && items.length > 0) {
    prepare('DELETE FROM borrow_application_items WHERE application_id = ?').run(id);

    const insertItem = prepare(`
      INSERT INTO borrow_application_items (
        id, application_id, tool_id, tool_code, tool_name,
        specification, apply_quantity, actual_quantity, calibration_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
    `);

    for (const item of items) {
      const tool = prepare('SELECT * FROM tools WHERE id = ?').get(item.tool_id) as Tool | undefined;
      if (!tool) continue;

      insertItem.run(
        uuidv4(),
        id,
        tool.id,
        tool.tool_code,
        tool.tool_name,
        tool.specification || null,
        item.apply_quantity || 1
      );
    }
  }

  res.json({ success: true, message: '更新成功' });
});

router.post('/:id/submit', authMiddleware, roleMiddleware('technician'), (req: Request, res: Response) => {
  const { id } = req.params;

  const application = prepare('SELECT * FROM borrow_applications WHERE id = ?').get(id) as BorrowApplication | undefined;
  
  if (!application) {
    return res.json({ success: false, message: '申请单不存在' });
  }

  if (application.applicant_id !== req.user!.userId) {
    return res.json({ success: false, message: '只能提交自己的申请单' });
  }

  if (application.status !== 'draft') {
    return res.json({ success: false, message: '仅草稿状态可提交' });
  }

  const items = prepare('SELECT * FROM borrow_application_items WHERE application_id = ?').all(id) as BorrowApplicationItem[];
  if (items.length === 0) {
    return res.json({ success: false, message: '申请单没有工具明细' });
  }

  prepare("UPDATE borrow_applications SET status = 'pending_approval', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

  res.json({ success: true, message: '提交成功' });
});

router.post('/:id/approve', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { remark } = req.body;

  const application = prepare('SELECT * FROM borrow_applications WHERE id = ?').get(id) as BorrowApplication | undefined;
  
  if (!application) {
    return res.json({ success: false, message: '申请单不存在' });
  }

  if (application.status !== 'pending_approval') {
    return res.json({ success: false, message: '仅待审批状态可审批' });
  }

  prepare(`
    UPDATE borrow_applications SET 
      status = 'approved', 
      approver_id = ?, 
      approver_name = ?, 
      approve_time = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user!.userId, req.user!.name, id);

  res.json({ success: true, message: '审批通过' });
});

router.post('/:id/reject', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { remark } = req.body;

  const application = prepare('SELECT * FROM borrow_applications WHERE id = ?').get(id) as BorrowApplication | undefined;
  
  if (!application) {
    return res.json({ success: false, message: '申请单不存在' });
  }

  if (application.status !== 'pending_approval') {
    return res.json({ success: false, message: '仅待审批状态可驳回' });
  }

  prepare(`
    UPDATE borrow_applications SET 
      status = 'rejected', 
      approver_id = ?, 
      approver_name = ?, 
      approve_time = CURRENT_TIMESTAMP,
      remark = COALESCE(?, remark),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user!.userId, req.user!.name, remark || null, id);

  res.json({ success: true, message: '已驳回' });
});

router.post('/:id/second-confirm', authMiddleware, roleMiddleware('technician'), (req: Request, res: Response) => {
  const { id } = req.params;

  const application = prepare('SELECT * FROM borrow_applications WHERE id = ?').get(id) as BorrowApplication | undefined;
  
  if (!application) {
    return res.json({ success: false, message: '申请单不存在' });
  }

  if (application.risk_level !== 'high') {
    return res.json({ success: false, message: '仅高风险维修需要双人确认' });
  }

  if (application.status !== 'approved' && application.status !== 'pending_approval') {
    return res.json({ success: false, message: '当前状态不能确认' });
  }

  if (application.second_confirmer_id) {
    return res.json({ success: false, message: '已完成双人确认' });
  }

  if (application.applicant_id === req.user!.userId) {
    return res.json({ success: false, message: '申请人不能作为第二确认人' });
  }

  prepare(`
    UPDATE borrow_applications SET 
      second_confirmer_id = ?, 
      second_confirmer_name = ?, 
      second_confirm_time = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user!.userId, req.user!.name, id);

  res.json({ success: true, message: '双人确认成功' });
});

router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;

  const application = prepare('SELECT * FROM borrow_applications WHERE id = ?').get(id) as BorrowApplication | undefined;
  
  if (!application) {
    return res.json({ success: false, message: '申请单不存在' });
  }

  if (application.status !== 'draft' && application.status !== 'rejected') {
    return res.json({ success: false, message: '仅草稿或驳回状态可删除' });
  }

  prepare('DELETE FROM borrow_applications WHERE id = ?').run(id);

  res.json({ success: true, message: '删除成功' });
});

export default router;
