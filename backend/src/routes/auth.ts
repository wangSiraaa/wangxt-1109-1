import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prepare } from '../db';
import { generateToken, authMiddleware } from '../middleware/auth';
import { User } from '../types';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ success: false, message: '用户名和密码不能为空' });
  }

  const user = prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;

  if (!user) {
    return res.json({ success: false, message: '用户不存在' });
  }

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    return res.json({ success: false, message: '密码错误' });
  }

  const token = generateToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name
  });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone
      }
    }
  });
});

router.get('/profile', authMiddleware, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: req.user
  });
});

router.get('/users', authMiddleware, (req: Request, res: Response) => {
  const { role } = req.query;
  
  let sql = 'SELECT id, username, name, role, phone, created_at FROM users';
  const params: any[] = [];
  
  if (role) {
    sql += ' WHERE role = ?';
    params.push(role);
  }
  
  const users = prepare(sql).all(...params);
  
  res.json({
    success: true,
    data: users
  });
});

router.post('/users', authMiddleware, (req: Request, res: Response) => {
  const { username, password, name, role, phone } = req.body;

  if (!username || !password || !name || !role) {
    return res.json({ success: false, message: '请填写完整信息' });
  }

  const existingUser = prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return res.json({ success: false, message: '用户名已存在' });
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);
  const id = uuidv4();

  prepare(`
    INSERT INTO users (id, username, password, name, role, phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, username, hashedPassword, name, role, phone || null);

  res.json({
    success: true,
    data: { id, username, name, role, phone }
  });
});

export default router;
