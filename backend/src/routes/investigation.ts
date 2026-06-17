import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prepare } from '../db';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { InvestigationReport, InvestigationStatus } from '../types';
import { logOperation, getCurrentShiftId } from '../utils/operationLog';

const router = Router();

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const { status, keyword, page = 1, pageSize = 20 } = req.query;

  let sql = 'SELECT * FROM investigation_reports WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM investigation_reports WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (status) {
    sql += ' AND status = ?';
    countSql += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  if (keyword) {
    sql += ' AND (report_no LIKE ? OR application_no LIKE ? OR missing_tools LIKE ?)';
    countSql += ' AND (report_no LIKE ? OR application_no LIKE ? OR missing_tools LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
    countParams.push(kw, kw, kw);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const reports = prepare(sql).all(...params) as InvestigationReport[];
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  res.json({
    success: true,
    data: reports,
    total: totalResult.total
  });
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;

  const report = prepare('SELECT * FROM investigation_reports WHERE id = ?').get(id) as InvestigationReport | undefined;
  
  if (!report) {
    return res.json({ success: false, message: '调查单不存在' });
  }

  res.json({ success: true, data: report });
});

router.put('/:id', authMiddleware, roleMiddleware('admin', 'quality'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    status, 
    investigation_result, 
    handle_remark,
    incident_description
  } = req.body;

  const report = prepare('SELECT * FROM investigation_reports WHERE id = ?').get(id) as InvestigationReport | undefined;
  
  if (!report) {
    return res.json({ success: false, message: '调查单不存在' });
  }

  const updateFields: string[] = [];
  const updateParams: any[] = [];

  if (status !== undefined) {
    updateFields.push('status = ?');
    updateParams.push(status);
  }

  if (investigation_result !== undefined) {
    updateFields.push('investigation_result = ?');
    updateParams.push(investigation_result);
  }

  if (handle_remark !== undefined) {
    updateFields.push('handle_remark = ?');
    updateParams.push(handle_remark);
  }

  if (incident_description !== undefined) {
    updateFields.push('incident_description = ?');
    updateParams.push(incident_description);
  }

  if (status && status !== report.status) {
    updateFields.push('handler_id = ?');
    updateFields.push('handler_name = ?');
    updateFields.push('handle_time = CURRENT_TIMESTAMP');
    updateParams.push(req.user!.userId);
    updateParams.push(req.user!.name);
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateParams.push(id);

  prepare(`UPDATE investigation_reports SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateParams);

  res.json({ success: true, message: '更新成功' });
});

router.post('/:id/close', authMiddleware, roleMiddleware('admin', 'quality'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { investigation_result, handle_remark } = req.body;

  const report = prepare('SELECT * FROM investigation_reports WHERE id = ?').get(id) as InvestigationReport | undefined;
  
  if (!report) {
    return res.json({ success: false, message: '调查单不存在' });
  }

  prepare(`
    UPDATE investigation_reports SET 
      status = 'closed',
      investigation_result = ?,
      handle_remark = ?,
      handler_id = ?,
      handler_name = ?,
      handle_time = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    investigation_result || null,
    handle_remark || null,
    req.user!.userId,
    req.user!.name,
    id
  );

  logOperation(req.user!, 'close_investigation_report', {
    businessId: id,
    businessNo: report.report_no,
    shiftId: report.shift_id || undefined,
    detail: `关闭调查单：${report.report_no}，调查结果：${investigation_result || '未填写'}`
  });

  res.json({ success: true, message: '调查单已关闭' });
});

router.post('/:id/submit-investigation', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { investigation_result, handle_remark } = req.body;

  const report = prepare('SELECT * FROM investigation_reports WHERE id = ?').get(id) as InvestigationReport | undefined;
  
  if (!report) {
    return res.json({ success: false, message: '调查单不存在' });
  }

  if (report.status !== 'pending' && report.status !== 'investigating') {
    return res.json({ success: false, message: '仅待处理或调查中状态可提交调查结果' });
  }

  if (!investigation_result) {
    return res.json({ success: false, message: '请填写调查结果' });
  }

  prepare(`
    UPDATE investigation_reports SET 
      status = 'quality_review',
      investigation_result = ?,
      handle_remark = ?,
      handler_id = ?,
      handler_name = ?,
      handle_time = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    investigation_result,
    handle_remark || null,
    req.user!.userId,
    req.user!.name,
    id
  );

  logOperation(req.user!, 'submit_investigation_result', {
    businessId: id,
    businessNo: report.report_no,
    shiftId: report.shift_id || undefined,
    detail: `提交调查结果：${report.report_no}，调查结果：${investigation_result}`
  });

  res.json({ success: true, message: '调查结果已提交，请质量员复核' });
});

router.post('/:id/quality-review', authMiddleware, roleMiddleware('quality'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { passed, review_remark } = req.body;

  const report = prepare('SELECT * FROM investigation_reports WHERE id = ?').get(id) as InvestigationReport | undefined;
  
  if (!report) {
    return res.json({ success: false, message: '调查单不存在' });
  }

  if (report.status !== 'quality_review') {
    return res.json({ success: false, message: '仅待质量复核状态可执行此操作' });
  }

  if (passed === undefined) {
    return res.json({ success: false, message: '请选择复核结果' });
  }

  const newStatus = passed ? 'closed' : 'investigating';
  const shiftId = getCurrentShiftId();

  prepare(`
    UPDATE investigation_reports SET 
      status = ?,
      quality_reviewer_id = ?,
      quality_reviewer_name = ?,
      quality_review_time = CURRENT_TIMESTAMP,
      quality_review_remark = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    newStatus,
    req.user!.userId,
    req.user!.name,
    review_remark || null,
    id
  );

  const returnItems = prepare(`
    SELECT ri.tool_id FROM return_items ri
    INNER JOIN return_records rr ON ri.return_record_id = rr.id
    WHERE rr.application_id = ? AND ri.status = 'missing'
  `).all(report.application_id) as { tool_id: string }[];

  if (passed && returnItems.length > 0) {
    const toolIds = returnItems.map((item: any) => item.tool_id);
    prepare("UPDATE tools SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id IN (" + 
      toolIds.map(() => '?').join(',') + ")").run(...toolIds);
  }

  logOperation(req.user!, 'quality_review_investigation', {
    businessId: id,
    businessNo: report.report_no,
    shiftId: shiftId || report.shift_id || undefined,
    detail: `质量员${passed ? '通过' : '驳回'}复核：${report.report_no}，复核意见：${review_remark || '无'}`
  });

  res.json({ 
    success: true, 
    message: passed ? '复核通过，工具状态已恢复可借' : '复核驳回，请重新调查' 
  });
});

export default router;
