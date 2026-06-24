import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { prisma } from '@/lib/prisma';
import { minioClient, BUCKET_PRIVATE, getPresignedDownloadUrl } from '@/lib/minio';
import { NotFoundError } from '@/lib/errors';

// ── PDF Generation ────────────────────────────────────────────

interface CertificateData {
  code: string;
  learnerName: string;
  courseTitle: string;
  issuingOrg: string;
  completedAt: Date;
  issuedAt: Date;
  courseHours?: number | null;
  expiresAt?: Date | null;
}

async function generateCertificatePdf(data: CertificateData): Promise<string> {
  const storagePath = `certificates/${data.code}.pdf`;

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;   // 841.89
    const H = doc.page.height;  // 595.28

    // ── Background gradient simulation (light yellow rect) ──────
    doc.rect(0, 0, W, H).fill('#FFFEF5');

    // ── Decorative border ────────────────────────────────────────
    doc
      .rect(20, 20, W - 40, H - 40)
      .lineWidth(3)
      .stroke('#C9A84C');

    doc
      .rect(28, 28, W - 56, H - 56)
      .lineWidth(1)
      .stroke('#E8C96C');

    // ── Header: Organization name ────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#7B5E00')
      .text(data.issuingOrg.toUpperCase(), 0, 55, { align: 'center', width: W });

    // ── Main title ───────────────────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(36)
      .fillColor('#4A3000')
      .text('CERTIFICATE OF COMPLETION', 0, 90, { align: 'center', width: W });

    // ── Subtitle line ────────────────────────────────────────────
    doc
      .moveTo(120, 148)
      .lineTo(W - 120, 148)
      .lineWidth(1)
      .stroke('#C9A84C');

    doc
      .font('Helvetica')
      .fontSize(13)
      .fillColor('#5C4400')
      .text('This is to certify that', 0, 162, { align: 'center', width: W });

    // ── Learner Name ─────────────────────────────────────────────
    doc
      .font('Helvetica-BoldOblique')
      .fontSize(30)
      .fillColor('#2C1A00')
      .text(data.learnerName, 0, 188, { align: 'center', width: W });

    doc
      .moveTo(200, 228)
      .lineTo(W - 200, 228)
      .lineWidth(0.5)
      .stroke('#C9A84C');

    // ── Course label ─────────────────────────────────────────────
    doc
      .font('Helvetica')
      .fontSize(13)
      .fillColor('#5C4400')
      .text('has successfully completed the course', 0, 240, { align: 'center', width: W });

    // ── Course Title ─────────────────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#4A3000')
      .text(`"${data.courseTitle}"`, 0, 265, { align: 'center', width: W });

    // ── Duration (optional) ──────────────────────────────────────
    let metaY = 300;
    if (data.courseHours) {
      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor('#7B5E00')
        .text(`Duration: ${data.courseHours} hours`, 0, metaY, { align: 'center', width: W });
      metaY += 22;
    }

    // ── Completed date ───────────────────────────────────────────
    const completedStr = data.completedAt.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#7B5E00')
      .text(`Completed on: ${completedStr}`, 0, metaY, { align: 'center', width: W });

    // ── Expires (optional) ───────────────────────────────────────
    if (data.expiresAt) {
      const expiresStr = data.expiresAt.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#9B7B2A')
        .text(`Valid until: ${expiresStr}`, 0, metaY + 20, { align: 'center', width: W });
    }

    // ── Footer: Issue date + cert code ───────────────────────────
    const issuedStr = data.issuedAt.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc
      .moveTo(120, H - 100)
      .lineTo(W - 120, H - 100)
      .lineWidth(1)
      .stroke('#C9A84C');

    // Left: Issued date
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#5C4400')
      .text(`Issued: ${issuedStr}`, 80, H - 85, { align: 'left', width: 300 });

    // Right: Certificate code
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#9B7B2A')
      .text(`Certificate Code: ${data.code}`, W - 380, H - 85, { align: 'right', width: 300 });

    // Center: Verify URL
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor('#7B5E00')
      .text(
        `Verify at: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.example.com'}/verify/${data.code}`,
        0,
        H - 55,
        { align: 'center', width: W },
      );

    doc.end();
  });

  // Upload PDF buffer to MinIO private bucket
  await new Promise<void>((resolve, reject) => {
    const readable = Readable.from(pdfBuffer);
    minioClient.putObject(
      BUCKET_PRIVATE,
      storagePath,
      readable,
      pdfBuffer.length,
      { 'Content-Type': 'application/pdf' },
      (err) => (err ? reject(err) : resolve()),
    );
  });

  return storagePath;
}

// ── Service functions ─────────────────────────────────────────

/**
 * Auto-issue certificate when enrollment is completed.
 * Generates PDF and stores in MinIO. Called from checkCourseCompletion.
 */
export async function issueCertificate(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      course: {
        select: {
          id: true,
          title: true,
          estimatedHours: true,
          ownerCompany: { select: { name: true } },
        },
      },
      certificate: true,
    },
  });

  if (!enrollment) throw new NotFoundError('Enrollment');
  if (enrollment.certificate) return enrollment.certificate; // Already issued
  if (!enrollment.completedAt) throw new Error('Course not completed yet');

  // Create certificate record first (get the code)
  const cert = await prisma.certificate.create({
    data: {
      enrollmentId,
      issuedAt: new Date(),
    },
  });

  // Generate PDF and upload to MinIO
  try {
    const pdfPath = await generateCertificatePdf({
      code: cert.code,
      learnerName: enrollment.user.fullName,
      courseTitle: enrollment.course.title,
      issuingOrg: enrollment.course.ownerCompany.name,
      completedAt: enrollment.completedAt,
      issuedAt: cert.issuedAt,
      courseHours: enrollment.course.estimatedHours,
      expiresAt: cert.expiresAt,
    });

    await prisma.certificate.update({
      where: { id: cert.id },
      data: { pdfUrl: pdfPath },
    });

    console.log(
      `[Certificate] Issued ${cert.code} with PDF for ${enrollment.user.email} — ${enrollment.course.title}`,
    );

    return { ...cert, pdfUrl: pdfPath };
  } catch (err) {
    // PDF generation failure should NOT block certificate issuance
    console.error(`[Certificate] PDF generation failed for ${cert.code}:`, err);
    return cert;
  }
}

/**
 * Get a signed download URL for a certificate PDF.
 * Returns null if no PDF has been generated yet.
 */
export async function getCertificatePdfUrl(code: string, userId: string): Promise<string | null> {
  const cert = await prisma.certificate.findUnique({
    where: { code },
    include: { enrollment: { select: { userId: true } } },
  });

  if (!cert) throw new NotFoundError('Chứng chỉ');
  if (cert.enrollment.userId !== userId) throw new NotFoundError('Chứng chỉ'); // hide existence

  if (!cert.pdfUrl) return null;

  return getPresignedDownloadUrl(cert.pdfUrl, 5 * 60); // 5 min signed URL
}

/**
 * Verify certificate by code (public endpoint — no auth required).
 */
export async function verifyCertificate(code: string) {
  const cert = await prisma.certificate.findUnique({
    where: { code },
    include: {
      enrollment: {
        include: {
          user: { select: { fullName: true, email: true } },
          course: {
            select: {
              title: true,
              estimatedHours: true,
              ownerCompany: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!cert) return null;

  const isExpired = cert.expiresAt ? cert.expiresAt < new Date() : false;

  return {
    code: cert.code,
    isValid: !isExpired,
    issuedAt: cert.issuedAt,
    expiresAt: cert.expiresAt,
    hasPdf: !!cert.pdfUrl,
    learnerName: cert.enrollment.user.fullName,
    courseTitle: cert.enrollment.course.title,
    courseHours: cert.enrollment.course.estimatedHours,
    issuingOrg: cert.enrollment.course.ownerCompany.name,
    completedAt: cert.enrollment.completedAt,
  };
}
