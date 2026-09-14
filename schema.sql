-- Taipei Day Trip schema
-- 建立資料庫
CREATE DATABASE IF NOT EXISTS taipei_day_trip
  CHARACTER SET utf8mb4 -- 設定字元編碼
  COLLATE utf8mb4_unicode_ci; -- 設定排序規則

USE taipei_day_trip;

-- 建立attraction表
CREATE TABLE IF NOT EXISTS attraction (
  id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  address VARCHAR(255) NOT NULL,
  transport TEXT,
  mrt VARCHAR(100) NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  INDEX idx_attraction_category (category),
  INDEX idx_attraction_mrt (mrt),
  INDEX idx_attraction_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 建立attraction_image表
CREATE TABLE IF NOT EXISTS attraction_image (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attraction_id INT NOT NULL,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_attraction_image_attraction
    FOREIGN KEY (attraction_id) REFERENCES attraction(id)
    ON DELETE CASCADE,
  INDEX idx_attraction_image_attraction_id (attraction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 建立 user 表（會員）
CREATE TABLE IF NOT EXISTS user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  UNIQUE KEY uk_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 建立 booking 表（預定行程）
CREATE TABLE IF NOT EXISTS booking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  attraction_id INT NOT NULL,
  date DATE NOT NULL,
  time VARCHAR(20) NOT NULL,
  price INT NOT NULL,
  UNIQUE KEY uk_booking_user (user_id),
  CONSTRAINT fk_booking_user
    FOREIGN KEY (user_id) REFERENCES user(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_booking_attraction
    FOREIGN KEY (attraction_id) REFERENCES attraction(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 建立 orders 表（訂單）
-- 一筆訂單對應一趟行程，因為 booking 表限制每位使用者只會有一筆待預訂行程
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(32) NOT NULL, -- 訂單編號，回傳給前端與 thankyou 頁使用
  user_id INT NOT NULL,
  attraction_id INT NOT NULL,
  date DATE NOT NULL,
  time VARCHAR(20) NOT NULL,
  price INT NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  status ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_orders_number (number),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES user(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_orders_attraction
    FOREIGN KEY (attraction_id) REFERENCES attraction(id)
    ON DELETE CASCADE,
  INDEX idx_orders_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 建立 payment 表（付款紀錄）
-- 付款成功或失敗都會留下一筆，方便日後對帳與補款
CREATE TABLE IF NOT EXISTS payment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status INT NOT NULL, -- TapPay 回傳的 status，0 代表成功
  message VARCHAR(255) NOT NULL,
  rec_trade_id VARCHAR(64) NULL, -- TapPay 交易編號
  amount INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  INDEX idx_payment_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 建立 mcp_token 表（MCP 存取金鑰）
-- 每位會員最多一組有效金鑰；產生新金鑰時會覆蓋舊的
-- 存放 bcrypt hash，原始 token 只在產生時回傳一次
CREATE TABLE IF NOT EXISTS mcp_token (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_mcp_token_user (user_id),
  CONSTRAINT fk_mcp_token_user
    FOREIGN KEY (user_id) REFERENCES user(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
