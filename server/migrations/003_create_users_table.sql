-- 创建用户表用于持久化用户数据
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'inspector',
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认用户（如果不存在）
INSERT INTO users (username, name, role, password, email) VALUES 
  ('admin', '管理员', 'admin', 'admin123', 'admin@example.com'),
  ('inspector', '验货员A', 'inspector', 'inspector123', 'inspector1@example.com'),
  ('inspector2', '验货员B', 'inspector', 'inspector456', 'inspector2@example.com')
ON CONFLICT (username) DO NOTHING;
