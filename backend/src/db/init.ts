import { initDatabase as initDb, getDatabase, saveDatabase, prepare } from './index';
import bcrypt from 'bcryptjs';

export async function initDatabaseData() {
  await initDb();
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('technician', 'admin', 'quality')),
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      tool_code TEXT UNIQUE NOT NULL,
      tool_name TEXT NOT NULL,
      category TEXT,
      specification TEXT,
      risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'medium', 'high')) DEFAULT 'low',
      calibration_date TEXT,
      calibration_expiry_date TEXT,
      status TEXT NOT NULL CHECK(status IN ('available', 'borrowed', 'maintenance', 'calibrating', 'scrapped', 'investigation_hold')) DEFAULT 'available',
      location TEXT,
      quantity INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS borrow_applications (
      id TEXT PRIMARY KEY,
      application_no TEXT UNIQUE NOT NULL,
      applicant_id TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      work_order_no TEXT,
      work_type TEXT,
      risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high')),
      purpose TEXT,
      expected_return_date TEXT,
      status TEXT NOT NULL CHECK(status IN ('draft', 'pending_approval', 'approved', 'rejected', 'issued', 'returned', 'partial_returned')) DEFAULT 'draft',
      shift_id TEXT,
      second_confirmer_id TEXT,
      second_confirmer_name TEXT,
      second_confirm_time TEXT,
      quality_confirmer_id TEXT,
      quality_confirmer_name TEXT,
      quality_confirm_time TEXT,
      approver_id TEXT,
      approver_name TEXT,
      approve_time TEXT,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (applicant_id) REFERENCES users(id),
      FOREIGN KEY (shift_id) REFERENCES shifts(id)
    );

    CREATE TABLE IF NOT EXISTS borrow_application_items (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      tool_code TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      specification TEXT,
      apply_quantity INTEGER NOT NULL DEFAULT 1,
      actual_quantity INTEGER DEFAULT 0,
      calibration_verified INTEGER DEFAULT 0,
      calibration_remark TEXT,
      FOREIGN KEY (application_id) REFERENCES borrow_applications(id) ON DELETE CASCADE,
      FOREIGN KEY (tool_id) REFERENCES tools(id)
    );

    CREATE TABLE IF NOT EXISTS issue_records (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      application_no TEXT NOT NULL,
      issuer_id TEXT NOT NULL,
      issuer_name TEXT NOT NULL,
      issue_time TEXT NOT NULL,
      remark TEXT,
      FOREIGN KEY (application_id) REFERENCES borrow_applications(id)
    );

    CREATE TABLE IF NOT EXISTS return_records (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      application_no TEXT NOT NULL,
      returner_id TEXT NOT NULL,
      returner_name TEXT NOT NULL,
      receiver_id TEXT,
      receiver_name TEXT,
      return_time TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('complete', 'partial', 'missing')),
      remark TEXT,
      FOREIGN KEY (application_id) REFERENCES borrow_applications(id)
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id TEXT PRIMARY KEY,
      return_record_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      tool_code TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      borrow_quantity INTEGER NOT NULL,
      return_quantity INTEGER NOT NULL,
      missing_quantity INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('returned', 'missing', 'damaged')),
      remark TEXT,
      FOREIGN KEY (return_record_id) REFERENCES return_records(id) ON DELETE CASCADE,
      FOREIGN KEY (tool_id) REFERENCES tools(id)
    );

    CREATE TABLE IF NOT EXISTS investigation_reports (
      id TEXT PRIMARY KEY,
      report_no TEXT UNIQUE NOT NULL,
      application_id TEXT NOT NULL,
      application_no TEXT NOT NULL,
      return_record_id TEXT NOT NULL,
      reporter_id TEXT NOT NULL,
      reporter_name TEXT NOT NULL,
      report_time TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'investigating', 'closed', 'quality_review')) DEFAULT 'pending',
      missing_tools TEXT NOT NULL,
      incident_description TEXT,
      investigation_result TEXT,
      handler_id TEXT,
      handler_name TEXT,
      handle_time TEXT,
      handle_remark TEXT,
      handover_id TEXT,
      quality_reviewer_id TEXT,
      quality_reviewer_name TEXT,
      quality_review_time TEXT,
      quality_review_result TEXT,
      quality_review_remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES borrow_applications(id),
      FOREIGN KEY (return_record_id) REFERENCES return_records(id),
      FOREIGN KEY (handover_id) REFERENCES shift_handovers(id)
    );

    CREATE TABLE IF NOT EXISTS calibration_records (
      id TEXT PRIMARY KEY,
      tool_id TEXT NOT NULL,
      tool_code TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      calibrator_id TEXT NOT NULL,
      calibrator_name TEXT NOT NULL,
      calibration_date TEXT NOT NULL,
      calibration_expiry_date TEXT,
      calibration_result TEXT NOT NULL CHECK(calibration_result IN ('pass', 'fail', 'limited')),
      calibration_certificate_no TEXT,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tool_id) REFERENCES tools(id)
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      shift_name TEXT NOT NULL,
      shift_type TEXT NOT NULL CHECK(shift_type IN ('day', 'night', 'middle')) DEFAULT 'day',
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      leader_id TEXT,
      leader_name TEXT,
      status TEXT NOT NULL CHECK(status IN ('active', 'ended')) DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leader_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS shift_handovers (
      id TEXT PRIMARY KEY,
      handover_no TEXT UNIQUE NOT NULL,
      from_shift_id TEXT NOT NULL,
      to_shift_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      from_user_name TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      to_user_name TEXT NOT NULL,
      handover_time TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'rejected')) DEFAULT 'pending',
      tool_snapshot TEXT,
      remark TEXT,
      confirmed_time TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_shift_id) REFERENCES shifts(id),
      FOREIGN KEY (to_shift_id) REFERENCES shifts(id)
    );

    CREATE TABLE IF NOT EXISTS shift_handover_items (
      id TEXT PRIMARY KEY,
      handover_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      tool_code TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL CHECK(status IN ('normal', 'missing', 'damaged', 'investigation_hold')) DEFAULT 'normal',
      investigation_id TEXT,
      remark TEXT,
      FOREIGN KEY (handover_id) REFERENCES shift_handovers(id) ON DELETE CASCADE,
      FOREIGN KEY (tool_id) REFERENCES tools(id),
      FOREIGN KEY (investigation_id) REFERENCES investigation_reports(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      business_id TEXT,
      business_no TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      shift_id TEXT,
      detail TEXT,
      result TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status);
    CREATE INDEX IF NOT EXISTS idx_tools_calibration_expiry ON tools(calibration_expiry_date);
    CREATE INDEX IF NOT EXISTS idx_borrow_applications_status ON borrow_applications(status);
    CREATE INDEX IF NOT EXISTS idx_borrow_applications_applicant ON borrow_applications(applicant_id);
    CREATE INDEX IF NOT EXISTS idx_investigation_reports_status ON investigation_reports(status);
    CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
    CREATE INDEX IF NOT EXISTS idx_shift_handovers_status ON shift_handovers(status);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_type ON operation_logs(operation_type);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_time ON operation_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_operator ON operation_logs(operator_id);
  `);

  const userCount = prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    
    const insertUser = prepare(`
      INSERT INTO users (id, username, password, name, role, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'user_001',
      'tech01',
      bcrypt.hashSync('123456', salt),
      '张机务',
      'technician',
      '13800138001'
    );

    insertUser.run(
      'user_002',
      'admin01',
      bcrypt.hashSync('123456', salt),
      '李管理员',
      'admin',
      '13800138002'
    );

    insertUser.run(
      'user_003',
      'quality01',
      bcrypt.hashSync('123456', salt),
      '王质量员',
      'quality',
      '13800138003'
    );

    insertUser.run(
      'user_004',
      'tech02',
      bcrypt.hashSync('123456', salt),
      '赵机务',
      'technician',
      '13800138004'
    );
  }

  const toolCount = prepare('SELECT COUNT(*) as count FROM tools').get() as { count: number };
  if (toolCount.count === 0) {
    const insertTool = prepare(`
      INSERT INTO tools (id, tool_code, tool_name, category, specification, risk_level, calibration_date, calibration_expiry_date, status, location, quantity, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setMonth(futureDate.getMonth() + 6);
    const pastDate = new Date(today);
    pastDate.setMonth(pastDate.getMonth() - 1);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    insertTool.run(
      'tool_001',
      'TL-001',
      '扭矩扳手',
      '扭力工具',
      '10-100N·m',
      'high',
      formatDate(today),
      formatDate(futureDate),
      'available',
      'A柜-01',
      5,
      '高精度扭矩扳手，用于发动机维修'
    );

    insertTool.run(
      'tool_002',
      'TL-002',
      '套筒扳手组',
      '套筒工具',
      '8-32mm',
      'medium',
      formatDate(today),
      formatDate(futureDate),
      'available',
      'A柜-02',
      10,
      '公制套筒扳手组套'
    );

    insertTool.run(
      'tool_003',
      'TL-003',
      '螺丝刀组',
      '旋具工具',
      '十字/一字套装',
      'low',
      null as any,
      null as any,
      'available',
      'B柜-01',
      20,
      '精密螺丝刀组套'
    );

    insertTool.run(
      'tool_004',
      'TL-004',
      '万用表',
      '测量仪器',
      '数字式',
      'medium',
      formatDate(pastDate),
      formatDate(pastDate),
      'available',
      'C柜-01',
      3,
      '已过期校准，待校准'
    );

    insertTool.run(
      'tool_005',
      'TL-005',
      '游标卡尺',
      '测量工具',
      '0-300mm',
      'high',
      formatDate(today),
      formatDate(futureDate),
      'available',
      'C柜-02',
      4,
      '高精度数显卡尺'
    );

    insertTool.run(
      'tool_006',
      'TL-006',
      '千斤顶',
      '顶升设备',
      '10吨',
      'high',
      formatDate(today),
      formatDate(futureDate),
      'available',
      'D区-01',
      2,
      '液压千斤顶'
    );
  }

  const shiftCount = prepare('SELECT COUNT(*) as count FROM shifts').get() as { count: number };
  if (shiftCount.count === 0) {
    const insertShift = prepare(`
      INSERT INTO shifts (id, shift_name, shift_type, start_time, end_time, leader_id, leader_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    insertShift.run(
      'shift_001',
      `${todayStr} 白班`,
      'day',
      `${todayStr} 08:00`,
      `${todayStr} 16:00`,
      'user_002',
      '李管理员',
      'active'
    );

    insertShift.run(
      'shift_002',
      `${todayStr} 中班`,
      'middle',
      `${todayStr} 16:00`,
      `${todayStr} 00:00`,
      'user_004',
      '赵机务',
      'active'
    );

    insertShift.run(
      'shift_003',
      `${todayStr} 夜班`,
      'night',
      `${todayStr} 00:00`,
      `${todayStr} 08:00`,
      'user_001',
      '张机务',
      'ended'
    );
  }

  saveDatabase();

  console.log('数据库初始化完成');
  console.log('默认账号:');
  console.log('  机务员: tech01 / 123456');
  console.log('  工具管理员: admin01 / 123456');
  console.log('  质量员: quality01 / 123456');
}

if (require.main === module) {
  initDatabaseData().catch(console.error);
}
