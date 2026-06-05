import { NextRequest, NextResponse } from 'next/server';
import { dbService, LogEntry } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';
import nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { taskId, to, subject, body: emailBody, selectedAttachments } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos: to, subject, body' }, { status: 400 });
    }

    const smtpConfig = await dbService.getSMTPConfig();
    const isSmtpConfigured = !!(smtpConfig && smtpConfig.host && smtpConfig.port);

    let attachmentsList: any[] = [];
    let task = null;

    if (taskId) {
      task = await dbService.getTaskById(taskId);
      if (task && selectedAttachments && Array.isArray(selectedAttachments)) {
        for (const attName of selectedAttachments) {
          const att = task.attachments.find((a) => a.filename === attName || a.id === attName);
          if (att) {
            const fullPath = path.join(process.cwd(), att.filepath);
            if (fs.existsSync(fullPath)) {
              attachmentsList.push({
                filename: att.filename,
                path: fullPath,
              });
            }
          }
        }
      }
    }

    if (isSmtpConfigured) {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port === 465,
        auth: smtpConfig.user && smtpConfig.pass ? {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        } : undefined,
      });

      await transporter.sendMail({
        from: smtpConfig.user === 'resend' ? 'recepcion@casamahana.com' : (smtpConfig.user || 'no-reply@hermes.hub'),
        to,
        subject,
        text: emailBody,
        attachments: attachmentsList,
      });
    } else {
      console.log(`[SIMULACIÓN CORREO] Enviado a: ${to}\nAsunto: ${subject}\nCuerpo:\n${emailBody}`);
    }

    if (taskId && task) {
      const newLog: LogEntry = {
        timestamp: new Date().toISOString(),
        user: 'AI/Sistema',
        action: `Tarea compartida por correo a: ${to}${isSmtpConfigured ? '' : ' [SIMULADO]'}`,
        type: 'AI',
      };
      await dbService.updateTask(taskId, {
        activityLog: [...(task.activityLog || []), newLog],
      });
    }

    return NextResponse.json({
      success: true,
      sentReal: isSmtpConfigured,
    });
  } catch (error: any) {
    console.error('Error sharing task via email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
