# ParkPulse Analytics — Oracle Database Practical Guide & Installation Manual
**Course:** Advanced Database Systems / Data Analytics Lab (MCA Curriculum)  
**Target RDBMS:** Oracle Database 19c / 21c Express Edition (XE) / Oracle 23ai Free  
**Related Scripts:**
- [`oracle_queries.sql`](file:///Volumes/Mac%20A/SmartParking/analytics/sql/oracle_queries.sql)
- [`create_tables.sql`](file:///Volumes/Mac%20A/SmartParking/analytics/sql/create_tables.sql) (MySQL 8.0)
- [`analysis_queries.sql`](file:///Volumes/Mac%20A/SmartParking/analytics/sql/analysis_queries.sql) (MySQL 8.0)

---

## 1. Introduction: Relational Architecture in Oracle vs. MySQL

ParkPulse Analytics operates on a fully normalized 3rd Normal Form (3NF) relational model. While MySQL 8 is used for the web platform's live relational extracts, the MCA academic syllabus explicitly requires proficiency with **Oracle Database Enterprise Edition / XE** and **Oracle SQL Developer**.

This guide details the exact environment setup, relational differences, and execution procedures for running the ParkPulse Smart Parking analytics suite on Oracle.

---

## 2. Oracle Database Setup & Installation

### Option A: Oracle Database 21c / 23ai Free via Docker (Cross-Platform / macOS / Linux / Windows)
For macOS (Apple Silicon / Intel) or Linux developers, running Oracle XE in Docker is the sanctioned industry practice:

```bash
# 1. Pull the official Oracle 23ai Free container image
docker pull container-registry.oracle.com/database/free:latest

# 2. Run the Oracle container instance
docker run -d --name oracle23ai \
  -p 1521:1521 \
  -e ORACLE_PWD=ParkPulseOracle2026# \
  container-registry.oracle.com/database/free:latest

# 3. Verify container is healthy
docker ps
```

### Option B: Local Windows / Linux Installation (Oracle XE 21c)
1. Download **Oracle Database 21c Express Edition** from the Oracle Technology Network.
2. Run the installer with administrative privileges.
3. Configure the **System Password** (e.g., `ParkPulseOracle2026#`).
4. Default Service Name / Pluggable Database: `XEPDB1` or `FREEPDB1`.
5. Connect using SQL*Plus or Oracle SQL Developer:
   - **Host:** `localhost`
   - **Port:** `1521`
   - **Service Name:** `FREEPDB1`
   - **Username:** `system`

---

## 3. Key Syntax & Architectural Differences: MySQL 8 vs. Oracle SQL

| Feature / Concept | MySQL 8.0 Syntax | Oracle Database 19c/21c/23ai | Technical Rationale |
| :--- | :--- | :--- | :--- |
| **Variable-Length Text** | `VARCHAR(100)` | `VARCHAR2(100)` | Oracle reserves `VARCHAR` for future standardization; `VARCHAR2` guarantees byte-length stability. |
| **Integers & Floating Point**| `INT`, `DECIMAL(10,2)` | `NUMBER(8)`, `NUMBER(10,2)` | Oracle represents all numeric data with a unified precision-scale `NUMBER` type. |
| **Boolean Values** | `BOOLEAN` (TINYINT 0/1) | `NUMBER(1) CHECK (col IN (0,1))` | Native boolean is limited to PL/SQL; SQL tables employ single-digit check constraints. |
| **Row Limiting** | `LIMIT 10` | `FETCH FIRST 10 ROWS ONLY` | ANSI SQL:2008 standard window clause introduced in Oracle 12c+. |
| **Date & Time Formatting** | `DATE_FORMAT(col, '%Y-%m-%d')`| `TO_CHAR(col, 'YYYY-MM-DD')` | Oracle requires explicit format masks with standard uppercase datetime specifiers. |
| **String Concatenation** | `CONCAT(a, ' - ', b)` | `a || ' - ' || b` | ANSI string concatenation operator `||` supports variadic operand chaining. |
| **Null Value Replacement** | `COALESCE(val, 'Default')` | `NVL(val, 'Default')` or `COALESCE()`| `NVL` is the native high-performance Oracle replacement function. |
| **Day of Week Extraction** | `DAYOFWEEK(start_time)` | `TO_CHAR(start_time, 'D')` | Oracle returns 1 (Sunday) through 7 (Saturday) via datetime format element `'D'`. |
| **Window Rankings** | `RANK() OVER (ORDER BY ...)` | `RANK() OVER (ORDER BY ...)` | Both fully support ANSI analytic window functions with identical execution plans. |

---

## 4. Step-by-Step Lab Execution Instructions

### Step 1: Create Dedicated Tablespace & User
Launch `sqlplus` or Oracle SQL Developer and create the sandbox user:

```sql
ALTER SESSION SET CONTAINER = FREEPDB1;

-- Create tablespace
CREATE TABLESPACE parkpulse_ts
DATAFILE 'parkpulse_data01.dbf' SIZE 100M AUTOEXTEND ON NEXT 50M;

-- Create project database user
CREATE USER parkpulse_admin IDENTIFIED BY "ParkPulsePass2026#"
DEFAULT TABLESPACE parkpulse_ts
QUOTA UNLIMITED ON parkpulse_ts;

-- Grant required developer privileges
GRANT CONNECT, RESOURCE, CREATE VIEW, CREATE PROCEDURE TO parkpulse_admin;
```

### Step 2: Execute DDL & Schema Creation
Connect as `parkpulse_admin` and execute the table creation script:

```bash
sqlplus parkpulse_admin/ParkPulsePass2026#@localhost:1521/FREEPDB1 @analytics/sql/oracle_queries.sql
```

### Step 3: Populate Oracle Tables from CSV
Use **Oracle SQL Developer** or **SQL*Loader** (`sqlldr`):
1. In SQL Developer, right-click on the `CUSTOMERS` table → **Import Data**.
2. Select `analytics/datasets/customers.csv`.
3. Choose format: **Comma**, Text delimiter: **none / double-quote**.
4. Repeat for `PARKING_LOCATIONS`, `BOOKINGS`, and `PARKING_SESSIONS`.

---

## 5. Lab Viva Questions & Answers (Oracle Specialization)

**Q1: How does Oracle handle transactions compared to MySQL?**  
*Answer:* MySQL with InnoDB auto-commits individual DML statements by default (`autocommit = 1`). Oracle requires an explicit `COMMIT` statement to persist DML changes; uncommitted transactions remain isolated to the active session until committed or rolled back.

**Q2: What is the role of `FETCH FIRST n ROWS ONLY` in Oracle?**  
*Answer:* Introduced in Oracle 12c, it is the ANSI SQL standard equivalent of MySQL's `LIMIT`. Internally, Oracle rewrites the query into an analytic `ROW_NUMBER()` or `ROWNUM` window filter, ensuring predictable pagination order when paired with `ORDER BY`.

**Q3: Why does Oracle use `VARCHAR2` instead of `VARCHAR`?**  
*Answer:* Oracle documents that the behavior of `VARCHAR` might change in future versions to conform strictly with ANSI SQL standards regarding empty string and null distinction. `VARCHAR2` guarantees consistent Oracle behavior where empty strings `''` are treated as `NULL`.

