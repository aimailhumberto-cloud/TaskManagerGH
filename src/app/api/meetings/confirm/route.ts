import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/dbService';
import { LogEntry } from '@/services/mockData';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const taskId = searchParams.get('taskId');
    const email = searchParams.get('email');

    if (!taskId || !email) {
      return new NextResponse(
        `<html>
          <head>
            <title>Error de Confirmación</title>
            <style>
              body { font-family: system-ui, sans-serif; background: #FAF8F5; color: #1C1917; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #EAE5D9; max-width: 400px; text-align: center; }
              h1 { color: #DC2626; font-size: 1.5rem; margin-top: 0; }
              p { color: #57534E; font-size: 0.95rem; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Parámetros inválidos</h1>
              <p>El enlace de confirmación no es válido o está incompleto.</p>
            </div>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const task = await dbService.getTaskById(taskId);
    if (!task) {
      return new NextResponse(
        `<html>
          <head>
            <title>Error de Confirmación</title>
            <style>
              body { font-family: system-ui, sans-serif; background: #FAF8F5; color: #1C1917; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #EAE5D9; max-width: 400px; text-align: center; }
              h1 { color: #DC2626; font-size: 1.5rem; margin-top: 0; }
              p { color: #57534E; font-size: 0.95rem; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Reunión no encontrada</h1>
              <p>La tarea o reunión asociada ya no existe o el ID es incorrecto.</p>
            </div>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Update meeting confirmations
    const currentConfirmations = task.meetingConfirmations || [];
    if (!currentConfirmations.includes(email)) {
      const updatedConfirmations = [...currentConfirmations, email];
      const newLog: LogEntry = {
        timestamp: new Date().toISOString(),
        user: 'AI/Sistema',
        action: `El miembro ${email} ha confirmado su asistencia a la reunión.`,
        type: 'AI',
      };
      await dbService.updateTask(taskId, {
        meetingConfirmations: updatedConfirmations,
        activityLog: [...(task.activityLog || []), newLog],
      });
    }

    // Render premium clear-themed RSVP confirmation page
    const htmlResponse = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirmación de Asistencia - Hermes Task Hub</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background-color: #FAF8F5;
              color: #1C1917;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 1rem;
              box-sizing: border-box;
            }
            .card {
              background: #FFFFFF;
              border: 1px solid #EAE5D9;
              border-radius: 1.5rem;
              box-shadow: 0 20px 25px -5px rgba(212, 163, 89, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
              padding: 3rem 2.5rem;
              max-width: 480px;
              width: 100%;
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .card::before {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 6px;
              background: linear-gradient(90deg, #D4A359, #B8860B);
            }
            .icon-wrapper {
              width: 80px;
              height: 80px;
              background: #FDFBF7;
              border: 2px solid #EADBB6;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 2rem;
              color: #B8860B;
              font-size: 2.2rem;
              animation: scaleUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            h1 {
              font-size: 1.75rem;
              font-weight: 800;
              margin: 0 0 0.75rem;
              color: #1C1917;
              letter-spacing: -0.025em;
            }
            p {
              font-size: 1rem;
              color: #57534E;
              margin: 0 0 2rem;
              line-height: 1.6;
            }
            .details-box {
              background: #FDFBF7;
              border: 1px solid #F3EFE6;
              border-radius: 1rem;
              padding: 1.5rem;
              margin-bottom: 2rem;
              text-align: left;
            }
            .details-title {
              font-size: 0.75rem;
              font-weight: 800;
              color: #A8A29E;
              text-transform: uppercase;
              letter-spacing: 0.15em;
              margin-bottom: 1rem;
              border-bottom: 1px dashed #EAE5D9;
              padding-bottom: 0.5rem;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 0.75rem;
              font-size: 0.9rem;
            }
            .detail-row:last-child {
              margin-bottom: 0;
            }
            .detail-label {
              color: #78716C;
              font-weight: 500;
            }
            .detail-val {
              color: #1C1917;
              font-weight: 700;
              text-align: right;
            }
            .footer-msg {
              font-size: 0.8rem;
              color: #A8A29E;
            }
            @keyframes scaleUp {
              from { transform: scale(0.8); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon-wrapper">📅</div>
            <h1>¡Asistencia Confirmada!</h1>
            <p>Tu respuesta ha sido registrada exitosamente. Hemos notificado al organizador a través de la bitácora de Hermes.</p>
            
            <div class="details-box">
              <div class="details-title">Detalles del Evento</div>
              <div class="detail-row">
                <span class="detail-label">Reunión:</span>
                <span class="detail-val">${task.title}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fecha:</span>
                <span class="detail-val">${task.dueDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Hora:</span>
                <span class="detail-val">${task.meetingTime || 'Hora por definir'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Invitado:</span>
                <span class="detail-val">${email}</span>
              </div>
            </div>
            
            <div class="footer-msg">Puedes cerrar esta ventana de forma segura.</div>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(htmlResponse, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('Error confirming meeting RSVP:', error);
    return new NextResponse(
      `<html>
        <head>
          <title>Error de Servidor</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #FAF8F5; color: #1C1917; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #EAE5D9; max-width: 400px; text-align: center; }
            h1 { color: #DC2626; font-size: 1.5rem; margin-top: 0; }
            p { color: #57534E; font-size: 0.95rem; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Error interno del servidor</h1>
            <p>${error.message}</p>
          </div>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 500 }
    );
  }
}
