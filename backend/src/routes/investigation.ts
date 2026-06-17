import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prepare } from '../db';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { InvestigationReport } from '../types';

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

  res.json({ success: true, message: '调查单已关闭' });
});

export default router;
