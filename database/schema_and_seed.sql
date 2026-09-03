-- =======================================================================
-- Database: db_dafa_archive
-- Sistem Penyimpanan Arsip Digital Terpusat (DAF Archive)
-- SMK Diponegoro Cipari
-- =======================================================================

CREATE DATABASE IF NOT EXISTS `db_dafa_archive` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `db_dafa_archive`;

-- 1. Drop existing tables if needed (in reverse foreign key order)
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `archives`;
DROP TABLE IF EXISTS `global_settings`;
DROP TABLE IF EXISTS `tahun_akademik`;
DROP TABLE IF EXISTS `client_access`;
DROP TABLE IF EXISTS `users`;

-- 2. Tabel Users
CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nama` VARCHAR(100) NOT NULL,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'client') DEFAULT 'client',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Client Access (7 Jabatan)
CREATE TABLE `client_access` (
    `user_id` INT PRIMARY KEY,
    `kepsek` BOOLEAN DEFAULT 0,
    `waka_kurikulum` BOOLEAN DEFAULT 0,
    `waka_kesiswaan` BOOLEAN DEFAULT 0,
    `waka_sarpras` BOOLEAN DEFAULT 0,
    `bendahara` BOOLEAN DEFAULT 0,
    `tu` BOOLEAN DEFAULT 0,
    `guru` BOOLEAN DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_client_access_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Tahun Akademik
CREATE TABLE `tahun_akademik` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `ta` VARCHAR(50) UNIQUE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Global Settings
CREATE TABLE `global_settings` (
    `id` INT PRIMARY KEY DEFAULT 1,
    `active_tahun_pelajaran` VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel Archives
CREATE TABLE `archives` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `stored_name` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `isFolder` TINYINT(1) DEFAULT 0,
    `size` INT DEFAULT 0,
    `tapel` VARCHAR(50) NOT NULL,
    `jabatan` VARCHAR(100) NOT NULL,
    `parent_path` TEXT,
    `user_id` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_tapel_jabatan` (`tapel`, `jabatan`),
    INDEX `idx_user_id` (`user_id`),
    CONSTRAINT `fk_archives_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabel Audit Logs
CREATE TABLE `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT,
    `username` VARCHAR(50),
    `action` VARCHAR(100),
    `details` TEXT,
    `ip_address` VARCHAR(45),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_user` (`user_id`),
    INDEX `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =======================================================================
-- SEED DATA
-- Default Password untuk semua akun: smk12345
-- Hash: $2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC
-- =======================================================================

-- Seed Admin User
INSERT INTO `users` (`id`, `nama`, `username`, `password`, `role`) VALUES
(1, 'Administrator DAF Archive', 'admin', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'admin');

-- Seed 19 Guru & Staf SMK Diponegoro Cipari
INSERT INTO `users` (`id`, `nama`, `username`, `password`, `role`) VALUES
(2, 'Lestari Kurniawati, S.Pd.', 'lestari', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(3, 'Santi Setiawan, S.Pd.', 'santi', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(4, 'Muniroh, S.Pd.', 'muniroh', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(5, 'Abdul Haris, S.Pd.', 'abdulharis', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(6, 'Rizki Fauzi', 'rizki', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(7, 'Budi Yani Zahara, S.Sos.I.', 'budiyani', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(8, 'Erlin Holinah, S.Pd.', 'erlin', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(9, 'Hilmi Haidar Ali, S.Kom.', 'hilmi', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(10, 'Usman Aziz, S.Kom.', 'usman', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(11, 'Siti Latifah, S.Pd.', 'sitilatifah', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(12, 'Fitri Handayani, S.Pd.I.', 'fitrihandayani', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(13, 'Muhamad Ridwan', 'muhamadridwan', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(14, 'Khusnul Mubin, S.Pd.', 'khusnulmubin', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(15, 'Febriana Eka Nur Azizah', 'febriana', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(16, 'Fitri Nur Elvi Handayani, S.Pd.', 'fitrinur', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(17, 'Rita Nofita, S.Pd., M.Pd.', 'ritanofita', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(18, 'Indra Karimah, S.Kom.', 'indrakarimah', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(19, 'Nafisah, S.Pd.', 'nafisah', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client'),
(20, 'Jihanisme Difanti, S.Kom.', 'jihanisme', '$2a$10$NqkTnsuGzVmStOpqoxNDLenc8e2VrQ6TT2/oF4ImbcZl0Qo.g/7bC', 'client');

-- Seed Client Access (RBAC Multi-Role 7 Jabatan)
INSERT INTO `client_access` (`user_id`, `kepsek`, `waka_kurikulum`, `waka_kesiswaan`, `waka_sarpras`, `bendahara`, `tu`, `guru`) VALUES
(2, 1, 0, 0, 0, 0, 0, 1), -- Lestari Kurniawati (Kepala Sekolah + Guru)
(3, 0, 1, 0, 0, 0, 0, 1), -- Santi Setiawan (Waka Kurikulum + Guru)
(4, 0, 0, 1, 0, 0, 0, 1), -- Muniroh (Waka Kesiswaan + Guru)
(5, 0, 0, 0, 1, 0, 0, 1), -- Abdul Haris (Waka Sarpras + Guru)
(6, 0, 0, 0, 0, 1, 0, 1), -- Rizki Fauzi (Bendahara 1 + Guru)
(7, 0, 0, 0, 0, 1, 0, 1), -- Budi Yani Zahara (Bendahara 2 + Guru)
(8, 0, 0, 0, 0, 0, 1, 1), -- Erlin Holinah (Operator Dapodik/TU + Guru)
(9, 0, 0, 0, 0, 0, 1, 1), -- Hilmi Haidar Ali (Toolman/TU + Guru)
(10, 0, 0, 0, 0, 0, 0, 1), -- Usman Aziz (Kaprodi TJKT / Guru)
(11, 0, 0, 0, 0, 0, 0, 1), -- Siti Latifah (Kaprodi AKL / Guru)
(12, 0, 0, 0, 0, 0, 0, 1), -- Fitri Handayani (Guru PAI)
(13, 0, 0, 0, 0, 0, 0, 1), -- Muhamad Ridwan (Guru TKJ)
(14, 0, 0, 0, 0, 0, 0, 1), -- Khusnul Mubin (Guru B. Inggris)
(15, 0, 0, 0, 0, 0, 0, 1), -- Febriana Eka Nur Azizah (Guru Matematika)
(16, 0, 0, 0, 0, 0, 0, 1), -- Fitri Nur Elvi Handayani (Guru Akuntansi)
(17, 0, 0, 0, 0, 0, 0, 1), -- Rita Nofita (Guru B. Inggris/PKN/BK)
(18, 0, 0, 0, 0, 0, 0, 1), -- Indra Karimah (Guru Jaringan)
(19, 0, 0, 0, 0, 0, 0, 1), -- Nafisah (Guru Seni Rupa/BK)
(20, 0, 0, 0, 0, 0, 0, 1); -- Jihanisme Difanti (Guru Informatika)

-- Seed Tahun Akademik
INSERT INTO `tahun_akademik` (`id`, `ta`) VALUES
(1, '2024/2025'),
(2, '2025/2026'),
(3, '2026/2027');

-- Seed Global Settings (Tahun Aktif Default: 2026/2027 per tanggal 28-08-2026)
INSERT INTO `global_settings` (`id`, `active_tahun_pelajaran`) VALUES
(1, '2026/2027');

-- Seed Log Awal
INSERT INTO `audit_logs` (`user_id`, `username`, `action`, `details`, `ip_address`) VALUES
(1, 'admin', 'SYSTEM_INIT', 'Sistem DAF Archive SMK Diponegoro Cipari diinisialisasi untuk TP 2026/2027.', '127.0.0.1');
