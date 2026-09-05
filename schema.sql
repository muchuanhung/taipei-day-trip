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
