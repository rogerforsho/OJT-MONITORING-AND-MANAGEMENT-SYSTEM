# Antigravity & Agent Operating Rules

## Project: Cross-Platform OJT Monitoring and Management System (Colegio de Montalban)

### Target Scope & Boundary
- **Institution:** Colegio de Montalban
- **Target Beneficiaries:** 4th-Year students under **Institute of Computing Studies (ICS)** and **Institute of Business and Entrepreneurship (IBE)**.
- **Explicit Exclusions:** No 1st-3rd year students, no outside institutions, no job application/recruitment systems, no MOA transactions, no payroll, no general HR, and **no offline functionality** (requires stable internet connection).

### Approved Technology Stack
- **Web App:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Mobile App:** React Native + Expo (Expo Go) + TypeScript + NativeWind
- **Backend:** Supabase (PostgreSQL, Supabase Auth, Private Storage, Row Level Security)
- **Do not replace or invent additional frameworks/technologies without explicit instructions.**

### 6 Approved Roles
1. **Student:** Online attendance, selfie submission, hour tracking, digital report submission, notifications.
2. **OJT Coordinator:** Student approval, company & supervisor assignment, attendance validation, report grading, progress monitoring.
3. **Company Supervisor:** Trainee attendance verification, selfie evidence review, feedback, performance evaluations.
4. **Program Head:** Department-level progress monitoring and summary reports (ICS / IBE).
5. **System Administrator:** User account management, announcements, system configuration.
6. **IT Experts / Evaluators:** Technical evaluation according to ISO/IEC 25010:2023.

### 9 Agile Increments
1. Authentication and role management
2. Student profile and OJT application (pre-deployment requirements)
3. Attendance and selfie submission
4. Rendered-hour computation
5. Document and report submission
6. Progress monitoring
7. Performance evaluation
8. Notifications and announcements
9. Administrative reports and finalization (read-only completed records)

### Hardware & Security Evaluation Directives
- **Hardware Constraint:** Must run cleanly on an Intel Core i5 / AMD Ryzen 5, **8 GB RAM**, 256 GB SSD machine.
- **Security Reporting Standard:** Security must be described as **"security-related features were evaluated"** under ISO/IEC 25010:2023.
- **Anti-Hallucination Rule:** Do not invent additional features, workflows, roles, technologies, or business rules not specified in the capstone manuscript.
