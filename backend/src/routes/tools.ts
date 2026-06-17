import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prepare, getDatabase } from '../db';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { Tool, ToolStatus } from '../types';

const router = Router();

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const { 
    keyword, 
    status, 
    risk_level, 
    category,
    calibration_expired,
    page = 1, 
    pageSize = 20 
  } = req.query;

  let sql = 'SELECT * FROM tools WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM tools WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (keyword) {
    sql += ' AND (tool_code LIKE ? OR tool_name LIKE ? OR specification LIKE ?)';
    countSql += ' AND (tool_code LIKE ? OR tool_name LIKE ? OR specification LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
    countParams.push(kw, kw, kw);
  }

  if (status) {
    sql += ' AND status = ?';
    countSql += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  if (risk_level) {
    sql += ' AND risk_level = ?';
    countSql += ' AND risk_level = ?';
    params.push(risk_level);
    countParams.push(risk_level);
  }

  if (category) {
    sql += ' AND category = ?';
    countSql += ' AND category = ?';
    params.push(category);
    countParams.push(category);
  }

  if (calibration_expired === 'true') {
    const today = new Date().toISOString().split('T')[0];
    sql += ' AND calibration_expiry_date IS NOT NULL AND calibration_expiry_date < ?';
    countSql += ' AND calibration_expiry_date IS NOT NULL AND calibration_expiry_date < ?';
    params.push(today);
    countParams.push(today);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const limit = parseInt(pageSize as string);
  const offset = (parseInt(page as string) - 1) * limit;
  params.push(limit, offset);

  const tools = prepare(sql).all(...params) as Tool[];
  const totalResult = prepare(countSql).get(...countParams) as { total: number };

  const today = new Date().toISOString().split('T')[0];
  const toolsWithCalibrationStatus = tools.map(tool => ({
    ...tool,
    is_calibration_expired: tool.calibration_expiry_date 
      ? tool.calibration_expiry_date < today 
      : false
  }));

  res.json({
    success: true,
    data: toolsWithCalibrationStatus,
    total: totalResult.total
  });
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const tool = prepare('SELECT * FROM tools WHERE id = ?').get(id) as Tool | undefined;

  if (!tool) {
    return res.json({ success: false, message: '工具不存在' });
  }

  const today = new Date().toISOString().split('T')[0];
  const toolWithStatus = {
    ...tool,
    is_calibration_expired: tool.calibration_expiry_date 
      ? tool.calibration_expiry_date < today 
      : false
  };

  res.json({ success: true, data: toolWithStatus });
});

router.post('/', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const {
    tool_code,
    tool_name,
    category,
    specification,
    risk_level = 'low',
    calibration_date,
    calibration_expiry_date,
    status = 'available',
    location,
    quantity = 1,
    description
  } = req.body;

  if (!tool_code || !tool_name) {
    return res.json({ success: false, message: '工具编码和名称不能为空' });
  }

  const existingTool = prepare('SELECT id FROM tools WHERE tool_code = ?').get(tool_code);
  if (existingTool) {
    return res.json({ success: false, message: '工具编码已存在' });
  }

  const id = uuidv4();

  prepare(`
    INSERT INTO tools (id, tool_code, tool_name, category, specification, risk_level, 
                       calibration_date, calibration_expiry_date, status, location, quantity, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, tool_code, tool_name, category || null, specification || null, risk_level,
    calibration_date || null, calibration_expiry_date || null, status,
    location || null, quantity, description || null
  );

  res.json({ success: true, data: { id } });
});

router.put('/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    tool_code,
    tool_name,
    category,
    specification,
    risk_level,
    calibration_date,
    calibration_expiry_date,
    status,
    location,
    quantity,
    description
  } = req.body;

  const tool = prepare('SELECT * FROM tools WHERE id = ?').get(id) as Tool | undefined;
  if (!tool) {
    return res.json({ success: false, message: '工具不存在' });
  }

  prepare(`
    UPDATE tools SET 
      tool_code = COALESCE(?, tool_code),
      tool_name = COALESCE(?, tool_name),
      category = COALESCE(?, category),
      specification = COALESCE(?, specification),
      risk_level = COALESCE(?, risk_level),
      calibration_date = COALESCE(?, calibration_date),
      calibration_expiry_date = COALESCE(?, calibration_expiry_date),
      status = COALESCE(?, status),
      location = COALESCE(?, location),
      quantity = COALESCE(?, quantity),
      description = COALESCE(?, description),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    tool_code || null,
    tool_name || null,
    category || null,
    specification || null,
    risk_level || null,
    calibration_date || null,
    calibration_expiry_date || null,
    status || null,
    location || null,
    quantity !== undefined ? quantity : null,
    description || null,
    id
  );

  res.json({ success: true, message: '更新成功' });
});

router.delete('/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { id } = req.params;

  const tool = prepare('SELECT * FROM tools WHERE id = ?').get(id);
  if (!tool) {
    return res.json({ success: false, message: '工具不存在' });
  }

  prepare('DELETE FROM tools WHERE id = ?').run(id);

  res.json({ success: true, message: '删除成功' });
});

router.get('/categories/list', authMiddleware, (req: Request, res: Response) => {
  const categories = prepare('SELECT DISTINCT category FROM tools WHERE category IS NOT NULL').all() as { category: string }[];
  
  res.json({
    success: true,
    data: categories.map(c => c.category)
  });
});

export default router;
