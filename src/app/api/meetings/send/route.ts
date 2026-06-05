import { NextRequest, NextResponse } from 'next/server';
import { dbService, LogEntry } from '@/services/dbService';
import { validateApiKey } from '@/lib/auth';
import nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

function generateIcs(
  taskTitle: string,
  description: string,
  dateStr: string,
  timeStr: string,
  email: string,
  confirmUrl: string,
  smtpUser: string
) {
  // Parse dateStr (YYYY-MM-DD) and timeStr (HH:MM)
  const cleanedDate = dateStr.replace(/-/g, '');
  const cleanedTime = timeStr.replace(/:/g, '') + '00';
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtStart = `${cleanedDate}T${cleanedTime}`;

  // DTEND: Add 30 minutes
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, min] = timeStr.split(':').map(Number);
  const startDate = new Date(year, month - 1, day, hour, min, 0);
  const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

  const endYear = endDate.getFullYear();
  const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDate.getDate()).padStart(2, '0');
  const endHour = String(endDate.getHours()).padStart(2, '0');
  const endMin = String(endDate.getMinutes()).padStart(2, '0');
  const dtEnd = `${endYear}${endMonth}${endDay}T${endHour}${endMin}00`;

  const eventUid = `meeting-${Date.now()}-${Math.floor(Math.random() * 1000)}@hermes.hub`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hermes Task Hub//Integrated Meetings//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${eventUid}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${taskTitle}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')} -> Confirmar asistencia: ${confirmUrl}`,
    `ORGANIZER;CN=Hermes Admin:mailto:${smtpUser || 'no-reply@hermes.hub'}`,
    `ATTENDEE;RSVP=TRUE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:${email}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { taskId, attendees, meetingTime, dueDate, selectedAttachments } = body;

    if (!taskId || !attendees || !Array.isArray(attendees) || attendees.length === 0 || !meetingTime || !dueDate) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos: taskId, attendees, meetingTime, dueDate' }, { status: 400 });
    }

    const task = await dbService.getTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Update task properties in the database to record that it is a meeting
    const updatedTask = await dbService.updateTask(taskId, {
      isMeeting: true,
      meetingTime,
      meetingAttendees: attendees,
      dueDate,
      meetingConfirmations: task.meetingConfirmations || [],
    });

    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const origin = `${proto}://${host}`;

    const smtpConfig = await dbService.getSMTPConfig();

    // Build standard attachments
    const attachmentsList: any[] = [];
    if (selectedAttachments && Array.isArray(selectedAttachments)) {
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

    const isSmtpConfigured = !!(smtpConfig && smtpConfig.host && smtpConfig.port);
    const simulatedEmails: any[] = [];

    const stepsText = task.steps && task.steps.length > 0
      ? '\n✅ Pasos / Subtareas:\n' + task.steps.map((s: any) => `- [${s.completed ? 'x' : ' '}] ${s.text}`).join('\n')
      : '';

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

      for (const attendee of attendees) {
        const confirmUrl = `${origin}/api/meetings/confirm?taskId=${taskId}&email=${encodeURIComponent(attendee)}`;
        
        const emailBody = `Hola,

Se te ha invitado a una reunión de coordinación para la tarea: "${task.title}".

📅 Fecha: ${dueDate}
🕒 Hora: ${meetingTime}
🚩 Prioridad: ${task.priority || 'Medium'}
📊 Estado: ${task.status || 'Pending'}

📝 Descripción de la Tarea:
${task.description || 'Sin descripción'}
${stepsText}

--------------------------------------------------
👉 Para confirmar tu asistencia, haz clic en el siguiente enlace:
${confirmUrl}

Se adjunta el archivo de calendario .ics para agendar esta reunión en tu aplicación de calendario (Outlook, Google Calendar, Apple Calendar, etc.).

Atentamente,
Hermes Task Hub`;

        const icsContent = generateIcs(
          task.title,
          emailBody,
          dueDate,
          meetingTime,
          attendee,
          confirmUrl,
          smtpConfig.user
        );

        await transporter.sendMail({
          from: smtpConfig.user || 'no-reply@hermes.hub',
          to: attendee,
          subject: `Invitación de Reunión: ${task.title}`,
          text: emailBody,
          attachments: [
            {
              filename: 'invite.ics',
              content: icsContent,
              contentType: 'text/calendar; method=REQUEST',
            },
            ...attachmentsList,
          ],
        });
      }
    } else {
      // Simulate sending emails and return the contents for UI preview
      for (const attendee of attendees) {
        const confirmUrl = `${origin}/api/meetings/confirm?taskId=${taskId}&email=${encodeURIComponent(attendee)}`;
        
        const emailBody = `Hola,

Se te ha invitado a una reunión de coordinación para la tarea: "${task.title}".

📅 Fecha: ${dueDate}
🕒 Hora: ${meetingTime}
🚩 Prioridad: ${task.priority || 'Medium'}
📊 Estado: ${task.status || 'Pending'}

📝 Descripción de la Tarea:
${task.description || 'Sin descripción'}
${stepsText}

--------------------------------------------------
👉 Para confirmar tu asistencia, haz clic en el siguiente enlace:
${confirmUrl}

Se adjunta el archivo de calendario .ics para agendar esta reunión en tu aplicación de calendario (Outlook, Google Calendar, Apple Calendar, etc.).

Atentamente,
Hermes Task Hub`;

        const icsContent = generateIcs(
          task.title,
          emailBody,
          dueDate,
          meetingTime,
          attendee,
          confirmUrl,
          'simulated-sender@hermes.hub'
        );

        simulatedEmails.push({
          to: attendee,
          subject: `Invitación de Reunión: ${task.title}`,
          body: emailBody,
          icsPreview: icsContent,
          attachments: attachmentsList.map((a) => a.filename),
        });
      }
    }

    // Add activity log to task stating invite was sent
    const newLog: LogEntry = {
      timestamp: new Date().toISOString(),
      user: 'AI/Sistema',
      action: `Invitaciones de reunión enviadas a: ${attendees.join(', ')} (Hora: ${meetingTime})${isSmtpConfigured ? '' : ' [SIMULADO]'}`,
      type: 'AI',
    };
    await dbService.updateTask(taskId, {
      activityLog: [...(updatedTask.activityLog || []), newLog],
    });

    return NextResponse.json({
      success: true,
      sentReal: isSmtpConfigured,
      simulatedEmails: isSmtpConfigured ? undefined : simulatedEmails,
    });
  } catch (error: any) {
    console.error('Error sending meeting invites:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
