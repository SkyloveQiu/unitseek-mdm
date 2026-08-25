-- IRREVERSIBLE: this recreates only the `fleet` database on
-- fleetmysql598793. It does not delete the MySQL Flexible Server.
-- Run as its Azure MySQL administrator after replacing the password below.

DROP DATABASE IF EXISTS `fleet`;
CREATE DATABASE `fleet`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'easy_mdm'@'%'
  IDENTIFIED BY 'REPLACE_WITH_A_LONG_UNIQUE_PASSWORD';
ALTER USER 'easy_mdm'@'%'
  IDENTIFIED BY 'REPLACE_WITH_A_LONG_UNIQUE_PASSWORD';
GRANT ALL PRIVILEGES ON `fleet`.* TO 'easy_mdm'@'%';
FLUSH PRIVILEGES;
