import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabaseData } from './db/init';
import authRouter from './routes/auth';
import toolsRouter from './routes/tools';
import applicationsRouter from './routes/applications';
import issueRouter from './routes/issue';
import returnRouter from './routes/return';
import investigationRouter from './routes/investigation';
import calibrationRouter from './routes/calibration';
import { authMiddleware } from './middleware/auth';
import { prepare } from './db';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRouter);
app.use('/api/tools', toolsRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/issue', issueRouter);
app.use('/api/return', returnRouter);
app.use('/api/investigation', investigationRouter);
app.use('/api/calibration', calibrationRouter);

app.get('/api/stats/dashboard', authMiddleware, (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const toolTotal = prepare('SELECT COUNT(*) as count FROM tools').get() as { count: number };
  const toolAvailable = prepare("SELECT COUNT(*) as count FROM tools WHERE status = 'available'").get() as { count: number };
  const toolBorrowed = prepare("SELECT COUNT(*) as count FROM tools WHERE status = 'borrowed'").get() as { count: number };
  
  const calibrationExpired = prepare(`
    SELECT COUNT(*) as count FROM tools 
    WHERE calibration_expiry_date IS NOT NULL 
      AND calibration_expiry_date < ?
      AND status != 'scrapped'
  `).get(today) as { count: number };

  const pendingApproval = prepare("SELECT COUNT(*) as count FROM borrow_applications WHERE status = 'pending_approval'").get() as { count: number };
  const pendingIssue = prepare("SELECT COUNT(*) as count FROM borrow_applications WHERE status = 'approved'").get() as { count: number };
  const borrowedCount = prepare("SELECT COUNT(*) as count FROM borrow_applications WHERE status = 'issued'").get() as { count: number };
  
  const pendingInvestigation = prepare("SELECT COUNT(*) as count FROM investigation_reports WHERE status = 'pending'").get() as { count: number };

  const recentApplications = prepare(`
    SELECT * FROM borrow_applications 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all();

  res.json({
    success: true,
    data: {
      tools: {
        total: toolTotal.count,
        available: toolAvailable.count,
        borrowed: toolBorrowed.count,
        calibration_expired: calibrationExpired.count
      },
      applications: {
        pending_approval: pendingApproval.count,
        pending_issue: pendingIssue.count,
        borrowed: borrowedCount.count
      },
      investigation: {
        pending: pendingInvestigation.count
      },
      recent_applications: recentApplications
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    await initDatabaseData();
    app.listen(PORT, () => {
      console.log(`工具借用系统后端服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();

export default app;
