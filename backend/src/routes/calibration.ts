import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prepare } from '../db';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { CalibrationRecord, Tool } from '../types';

const router = Router();

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const { tool_id, keyword, page = 1, pageSize = 20 } = req.query;

  let sql = 'SELECT * FROM calibration_records WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM calibration_records WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (tool_id) {
    sql += ' AND tool_id = ?';
    countSql += ' AND tool_id = ?';
    params.push(tool_id);
    countParams.push(tool_id);
  }

  if (keyword) {
    sql += ' AND (tool_code LIKE ? OR tool_name LIKE ? OR calibration_certificate_no LIKE ?)';
    countSql += ' AND (tool_code LIKE ? OR tool_name LIKE ? OR calibration_certificate_no LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
    countParams.push(kw, kw, kw);
  }

  sql += ' ORDER BY calibration_date DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const records = prepare(sql).all(...params) as CalibrationRecord[];
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  res.json({
    success: true,
    data: records,
    total: totalResult.total
  });
});

router.post('/', authMiddleware, roleMiddleware('quality', 'admin'), (req: Request, res: Response) => {
  const {
    tool_id,
    calibration_date,
    calibration_expiry_date,
    calibration_result,
    calibration_certificate_no,
    remark
  } = req.body;

  if (!tool_id || !calibration_date || !calibration_result) {
    return res.json({ success: false, message: '请填写必要信息' });
  }

  const tool = prepare('SELECT * FROM tools WHERE id = ?').get(tool_id) as Tool | undefined;
  if (!tool) {
    return res.json({ success: false, message: '工具不存在' });
  }

  const recordId = uuidv4();

  prepare(`
    INSERT INTO calibration_records (
      id, tool_id, tool_code, tool_name, calibrator_id, calibrator_name,
      calibration_date, calibration_expiry_date, calibration_result,
      calibration_certificate_no, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordId,
    tool_id,
    tool.tool_code,
    tool.tool_name,
    req.user!.userId,
    req.user!.name,
    calibration_date,
    calibration_expiry_date || null,
    calibration_result,
    calibration_certificate_no || null,
    remark || null
  );

  prepare(`
    UPDATE tools SET 
      calibration_date = ?,
      calibration_expiry_date = ?,
      status = CASE WHEN ? = 'pass' THEN status ELSE 'calibrating' END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    calibration_date,
    calibration_expiry_date || null,
    calibration_result,
    tool_id
  );

  res.json({ success: true, data: { id: recordId } });
});

router.get('/tools/calibration-expired', authMiddleware, (req: Request, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  
  const tools = prepare(`
    SELECT * FROM tools 
    WHERE calibration_expiry_date IS NOT NULL 
      AND calibration_expiry_date < ?
      AND status != 'scrapped'
    ORDER BY calibration_expiry_date ASC
  `).all(today) as Tool[];

  res.json({
    success: true,
    data: tools
  });
});

router.get('/tools/calibration-due', authMiddleware, (req: Request, res: Response) => {
  const { days = 30 } = req.query;
  const today = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + parseInt(days as string));
  
  const tools = prepare(`
    SELECT * FROM tools 
    WHERE calibration_expiry_date IS NOT NULL 
      AND calibration_expiry_date >= ?
      AND calibration_expiry_date <= ?
      AND status != 'scrapped'
    ORDER BY calibration_expiry_date ASC
  `).all(today.toISOString().split('T')[0], dueDate.toISOString().split('T')[0]) as Tool[];

  res.json({
    success: true,
    data: tools
  });
});

export default router;
