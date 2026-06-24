import { PrismaClient, OrgType, RoleType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. ORGANIZATIONS ──────────────────────────────────────
  const group = await prisma.organization.upsert({
    where: { code_companyId: { code: 'TDN', companyId: '' } },
    update: {},
    create: {
      code: 'TDN',
      name: 'Tập đoàn VIA',
      type: OrgType.group,
      companyId: '',
      displayOrder: 0,
    },
  });

  const companyA = await prisma.organization.upsert({
    where: { code_companyId: { code: 'CTA', companyId: group.id } },
    update: {},
    create: {
      code: 'CTA',
      name: 'Công ty A',
      type: OrgType.company,
      parentId: group.id,
      companyId: group.id,
      displayOrder: 1,
    },
  });

  const companyB = await prisma.organization.upsert({
    where: { code_companyId: { code: 'CTB', companyId: group.id } },
    update: {},
    create: {
      code: 'CTB',
      name: 'Công ty B',
      type: OrgType.company,
      parentId: group.id,
      companyId: group.id,
      displayOrder: 2,
    },
  });

  const deptHCNS = await prisma.organization.upsert({
    where: { code_companyId: { code: 'HCNS', companyId: companyA.id } },
    update: {},
    create: {
      code: 'HCNS',
      name: 'Phòng HCNS',
      type: OrgType.dept,
      parentId: companyA.id,
      companyId: companyA.id,
      displayOrder: 1,
    },
  });

  const deptKD = await prisma.organization.upsert({
    where: { code_companyId: { code: 'KD', companyId: companyA.id } },
    update: {},
    create: {
      code: 'KD',
      name: 'Phòng Kinh doanh',
      type: OrgType.dept,
      parentId: companyA.id,
      companyId: companyA.id,
      displayOrder: 2,
    },
  });

  const deptKT = await prisma.organization.upsert({
    where: { code_companyId: { code: 'KT', companyId: companyB.id } },
    update: {},
    create: {
      code: 'KT',
      name: 'Phòng Kỹ thuật',
      type: OrgType.dept,
      parentId: companyB.id,
      companyId: companyB.id,
      displayOrder: 1,
    },
  });

  const deptIT = await prisma.organization.upsert({
    where: { code_companyId: { code: 'IT', companyId: companyB.id } },
    update: {},
    create: {
      code: 'IT',
      name: 'Phòng CNTT',
      type: OrgType.dept,
      parentId: companyB.id,
      companyId: companyB.id,
      displayOrder: 2,
    },
  });

  console.log('✅ Organizations created');

  // ── 2. USERS (1 mỗi role) ─────────────────────────────────
  const passwordHash = await bcrypt.hash('Password@123', 10);

  const userGroupAdmin = await prisma.user.upsert({
    where: { email: 'group_admin@via.vn' },
    update: {},
    create: {
      email: 'group_admin@via.vn',
      passwordHash,
      fullName: 'Admin Tập đoàn',
      employeeCode: 'EMP001',
      jobTitle: 'Group Administrator',
    },
  });

  const userGroupHrm = await prisma.user.upsert({
    where: { email: 'group_hrm@via.vn' },
    update: {},
    create: {
      email: 'group_hrm@via.vn',
      passwordHash,
      fullName: 'HRM Tập đoàn',
      employeeCode: 'EMP002',
      jobTitle: 'Group HRM',
    },
  });

  const userCompanyAdmin = await prisma.user.upsert({
    where: { email: 'company_admin@via.vn' },
    update: {},
    create: {
      email: 'company_admin@via.vn',
      passwordHash,
      fullName: 'Admin Công ty A',
      employeeCode: 'EMP003',
      jobTitle: 'Company Administrator',
    },
  });

  const userHrManager = await prisma.user.upsert({
    where: { email: 'hr_manager@via.vn' },
    update: {},
    create: {
      email: 'hr_manager@via.vn',
      passwordHash,
      fullName: 'HR Manager',
      employeeCode: 'EMP004',
      jobTitle: 'HR Manager',
    },
  });

  const userInstructor = await prisma.user.upsert({
    where: { email: 'instructor@via.vn' },
    update: {},
    create: {
      email: 'instructor@via.vn',
      passwordHash,
      fullName: 'Giảng viên A',
      employeeCode: 'EMP005',
      jobTitle: 'Instructor',
    },
  });

  const userLearner1 = await prisma.user.upsert({
    where: { email: 'learner1@via.vn' },
    update: {},
    create: {
      email: 'learner1@via.vn',
      passwordHash,
      fullName: 'Học viên 1',
      employeeCode: 'EMP006',
      jobTitle: 'Staff',
    },
  });

  const userLearner2 = await prisma.user.upsert({
    where: { email: 'learner2@via.vn' },
    update: {},
    create: {
      email: 'learner2@via.vn',
      passwordHash,
      fullName: 'Học viên 2',
      employeeCode: 'EMP007',
      jobTitle: 'Staff',
    },
  });

  console.log('✅ Users created');

  // ── 3. USER ROLES ──────────────────────────────────────────
  await prisma.userRole.upsert({
    where: { userId_role_organizationId: { userId: userGroupAdmin.id, role: RoleType.group_admin, organizationId: group.id } },
    update: {},
    create: { userId: userGroupAdmin.id, role: RoleType.group_admin, organizationId: group.id },
  });

  await prisma.userRole.upsert({
    where: { userId_role_organizationId: { userId: userGroupHrm.id, role: RoleType.group_hrm, organizationId: group.id } },
    update: {},
    create: { userId: userGroupHrm.id, role: RoleType.group_hrm, organizationId: group.id },
  });

  await prisma.userRole.upsert({
    where: { userId_role_organizationId: { userId: userCompanyAdmin.id, role: RoleType.company_admin, organizationId: companyA.id } },
    update: {},
    create: { userId: userCompanyAdmin.id, role: RoleType.company_admin, organizationId: companyA.id },
  });

  await prisma.userRole.upsert({
    where: { userId_role_organizationId: { userId: userHrManager.id, role: RoleType.hr_manager, organizationId: deptHCNS.id } },
    update: {},
    create: { userId: userHrManager.id, role: RoleType.hr_manager, organizationId: deptHCNS.id },
  });

  await prisma.userRole.upsert({
    where: { userId_role_organizationId: { userId: userInstructor.id, role: RoleType.instructor, organizationId: deptKD.id } },
    update: {},
    create: { userId: userInstructor.id, role: RoleType.instructor, organizationId: deptKD.id },
  });

  await prisma.userRole.upsert({
    where: { userId_role_organizationId: { userId: userLearner1.id, role: RoleType.learner, organizationId: deptKD.id } },
    update: {},
    create: { userId: userLearner1.id, role: RoleType.learner, organizationId: deptKD.id },
  });

  await prisma.userRole.upsert({
    where: { userId_role_organizationId: { userId: userLearner2.id, role: RoleType.learner, organizationId: deptKT.id } },
    update: {},
    create: { userId: userLearner2.id, role: RoleType.learner, organizationId: deptKT.id },
  });

  console.log('✅ User roles assigned');

  // ── 4. JOB POSITIONS ───────────────────────────────────────
  await prisma.jobPosition.upsert({
    where: { companyId_code: { companyId: companyA.id, code: 'SALE-SR' } },
    update: {},
    create: {
      companyId: companyA.id,
      organizationId: deptKD.id,
      code: 'SALE-SR',
      title: 'Senior Sales Executive',
      level: 'senior',
      description: 'Chuyên viên kinh doanh cấp cao',
    },
  });

  await prisma.jobPosition.upsert({
    where: { companyId_code: { companyId: companyA.id, code: 'HR-MGR' } },
    update: {},
    create: {
      companyId: companyA.id,
      organizationId: deptHCNS.id,
      code: 'HR-MGR',
      title: 'HR Manager',
      level: 'manager',
      description: 'Quản lý nhân sự',
    },
  });

  await prisma.jobPosition.upsert({
    where: { companyId_code: { companyId: companyB.id, code: 'DEV-SR' } },
    update: {},
    create: {
      companyId: companyB.id,
      organizationId: deptIT.id,
      code: 'DEV-SR',
      title: 'Senior Developer',
      level: 'senior',
      description: 'Lập trình viên cấp cao',
    },
  });

  console.log('✅ Job positions created');

  // ── 5. SAMPLE COURSE ───────────────────────────────────────
  const course = await prisma.course.upsert({
    where: { id: 'seed-course-001' },
    update: {},
    create: {
      id: 'seed-course-001',
      ownerCompanyId: companyA.id,
      createdById: userInstructor.id,
      title: 'Kỹ năng bán hàng chuyên nghiệp',
      description: 'Khóa học cơ bản về kỹ năng bán hàng cho nhân viên kinh doanh',
      estimatedHours: 8,
      completionMode: 'ALL_LESSONS',
      isPublished: true,
    },
  });

  const section1 = await prisma.courseSection.upsert({
    where: { courseId_displayOrder: { courseId: course.id, displayOrder: 1 } },
    update: {},
    create: {
      courseId: course.id,
      title: 'Chương 1: Nền tảng bán hàng',
      displayOrder: 1,
      estimatedMinutes: 120,
      isRequired: true,
    },
  });

  const section2 = await prisma.courseSection.upsert({
    where: { courseId_displayOrder: { courseId: course.id, displayOrder: 2 } },
    update: {},
    create: {
      courseId: course.id,
      title: 'Chương 2: Kỹ thuật chốt đơn',
      displayOrder: 2,
      estimatedMinutes: 90,
      isRequired: true,
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'seed-lesson-001' },
    update: {},
    create: {
      id: 'seed-lesson-001',
      sectionId: section1.id,
      title: 'Bài 1: Tâm lý khách hàng',
      displayOrder: 1,
      contentType: 'video',
      estimatedMinutes: 30,
      isRequired: true,
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'seed-lesson-002' },
    update: {},
    create: {
      id: 'seed-lesson-002',
      sectionId: section1.id,
      title: 'Bài 2: Quy trình bán hàng 7 bước',
      displayOrder: 2,
      contentType: 'document',
      estimatedMinutes: 45,
      isRequired: true,
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'seed-lesson-003' },
    update: {},
    create: {
      id: 'seed-lesson-003',
      sectionId: section2.id,
      title: 'Bài 3: Xử lý từ chối',
      displayOrder: 1,
      contentType: 'video',
      estimatedMinutes: 40,
      isRequired: true,
    },
  });

  await prisma.lesson.upsert({
    where: { id: 'seed-lesson-004' },
    update: {},
    create: {
      id: 'seed-lesson-004',
      sectionId: section2.id,
      title: 'Bài 4: Kiểm tra cuối chương',
      displayOrder: 2,
      contentType: 'quiz',
      estimatedMinutes: 20,
      isRequired: true,
    },
  });

  console.log('✅ Sample course with 2 sections & 4 lessons created');

  // ── 6. COMPANY LEARNING POLICY ────────────────────────────
  await prisma.companyLearningPolicy.upsert({
    where: { companyId: companyA.id },
    update: {},
    create: {
      companyId: companyA.id,
      autoEnrollOnPositionChange: false,
      requireManagerApproval: true,
      positionChangeGraceDays: 7,
      allowSelfAssessment: true,
      reminderBeforeDeadlineDays: [14, 7, 1],
    },
  });

  console.log('✅ Company learning policy created');
  console.log('');
  console.log('🎉 Seed completed!');
  console.log('');
  console.log('Test accounts (password: Password@123):');
  console.log('  group_admin@via.vn   → group_admin');
  console.log('  group_hrm@via.vn     → group_hrm');
  console.log('  company_admin@via.vn → company_admin (Công ty A)');
  console.log('  hr_manager@via.vn    → hr_manager');
  console.log('  instructor@via.vn    → instructor');
  console.log('  learner1@via.vn      → learner (Phòng KD)');
  console.log('  learner2@via.vn      → learner (Phòng KT, Công ty B)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
