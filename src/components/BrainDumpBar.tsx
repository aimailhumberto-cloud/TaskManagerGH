'use client';
import { useRef, useState } from 'react';

interface BrainDumpBarProps {
  onProcessed: (message: string) => Promise<void> | void;
}

export default function BrainDumpBar({ onProcessed }: BrainDumpBarProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [askFirst, setAskFirst] = useState(false);
  const [feedback, setFeedback] = useState('');
  const recognitionRef = useRef<any>(null);

  const toggleVoiceDictation = () => {
    if (recording) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      setRecording(false);
      return;
    }

    const SpeechRecognition =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setFeedback(
        '💡 En tu celular puedes tocar el micrófono del teclado (iOS/Android) o usar Safari/Chrome para dictar directamente.'
      );
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'es-PA';
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map((r: any) => r[0]?.transcript || '')
          .join(' ')
          .trim();
        if (transcript) {
          setText(prev => (prev ? `${prev}; ${transcript}` : transcript));
        }
      };
      rec.onerror = () => {
        setRecording(false);
      };
      rec.onend = () => {
        setRecording(false);
      };
      recognitionRef.current = rec;
      rec.start();
      setRecording(true);
      setFeedback('🎙️ Escuchando... habla con naturalidad y toca Detener al terminar.');
    } catch {
      setFeedback('Permite el acceso al micrófono en el navegador para dictar.');
    }
  };

  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    if (recording) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      setRecording(false);
    }
    setLoading(true);
    setFeedback('Procesando y clasificando por empresa, fecha y hora…');
    try {
      const res = await fetch('/api/agent/hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'brain_dump',
          text: text.trim(),
          defaultMode: askFirst ? 'ask_first' : 'auto_confirm',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo procesar el volcado rápido.');
      }
      setText('');
      const msg = `✨ ${data.count} ${data.count === 1 ? 'registro creado' : 'registros creados'} (${
        askFirst ? 'en Bandeja por Validar' : 'agendados en directo'
      }).`;
      setFeedback(msg);
      await onProcessed(msg);
    } catch (err: any) {
      setFeedback(err?.message || 'Error al procesar el volcado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="tm-pane tm-pane-dark tm-brain-dump-bar" aria-label="Volcado rápido inteligente">
      <form className="tm-brain-dump-form" onSubmit={handleProcess}>
        <div className="tm-brain-dump-label">
          <span className="tm-brain-dump-badge">🎙️ VOLCADO RÁPIDO · BRAIN DUMP</span>
          <small>
            Dicta o escribe varias tareas o reuniones separadas por punto y coma (`;`) y se asignan solas a tu empresa y
            agenda:
          </small>
        </div>
        <div className="tm-brain-dump-controls">
          <input
            type="text"
            className="tm-brain-dump-input"
            placeholder='Ej: "Mañana 10am reunión con Armando sobre IA para Todos; pedir cotización a Ingredienta; revisar pagos Surf Shack el viernes"'
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className={`tm-soft-button tm-brain-mic-btn ${recording ? 'is-recording' : ''}`}
            onClick={toggleVoiceDictation}
            title="Dictar con el micrófono del celular o computadora"
          >
            {recording ? '⏹️ Detener' : '🎙️ Dictar'}
          </button>
          <label className="tm-brain-mode-toggle" title="Si activas esto, van primero a tu Bandeja por Validar">
            <input type="checkbox" checked={askFirst} onChange={e => setAskFirst(e.target.checked)} />
            <span>Preguntar antes</span>
          </label>
          <button type="submit" className="tm-gold-button" disabled={loading || !text.trim()}>
            {loading ? 'Procesando…' : '✨ Procesar y Agendar'}
          </button>
        </div>
      </form>
      {feedback && <p className="tm-brain-dump-feedback">{feedback}</p>}
    </section>
  );
}
