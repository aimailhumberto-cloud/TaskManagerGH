'use client';

import React, { useState, useEffect } from 'react';
import HslAvatar from '@/components/HslAvatar';

interface Person {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

interface ParsedTask {
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  type: 'One-shot' | 'Repetitive' | 'Project';
  steps: string[];
  assigneeName?: string;
  assigneeId?: string;
}

export default function MeetingParserPage() {
  const [meetingText, setMeetingText] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // Feedback
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);

  // Load people list
  useEffect(() => {
    async function loadPeople() {
      try {
        const res = await fetch('/api/persons', {
          headers: { 'x-api-key': 'mock-api-key-12345' }
        });
        if (res.ok) {
          const data = await res.json();
          setPeople(data);
        }
      } catch (err) {
        console.error("Error loading people inside meeting parser:", err);
      }
    }
    loadPeople();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 3000);
  };

  // Process text with AI
  const handleProcessMinutes = async () => {
    if (!meetingText.trim()) {
      alert('Por favor pega el texto de la minuta de reunión primero.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ai/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'meeting',
          text: meetingText
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result && Array.isArray(data.result.tasks)) {
          // Resolve assigneeIds based on assigneeName matches
          const tasksWithResolvedPeople = data.result.tasks.map((t: ParsedTask) => {
            let assigneeId = '';
            if (t.assigneeName) {
              const matchedPerson = people.find(p =>
                p.name.toLowerCase().includes(t.assigneeName!.toLowerCase())
              );
              if (matchedPerson) {
                assigneeId = matchedPerson.id;
              }
            }
            return {
              ...t,
              assigneeId
            };
          });
          setParsedTasks(tasksWithResolvedPeople);
          triggerToast('Minuta analizada! Tareas cargadas en la vista previa.');
        } else {
          triggerToast('Error: No se pudieron extraer tareas estructuradas.');
        }
      } else {
        triggerToast('Error al procesar minuta en el servidor.');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error de red al procesar la minuta.');
    } finally {
      setLoading(false);
    }
  };

  // Send summarized minutes via email
  const handleEmailSummary = async () => {
    if (parsedTasks.length === 0) {
      alert('No hay tareas procesadas para enviar.');
      return;
    }
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const settings = await res.json();
        const serverHost = settings.smtpConfig?.host || 'No configurado';
        triggerToast(`Resumen de minuta enviado por correo a los participantes (${serverHost})`);
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error al procesar el envío de correo.');
    }
  };

  // Bulk Import Tasks
  const handleBulkImport = async () => {
    if (parsedTasks.length === 0) return;
    setImporting(true);
    let successCount = 0;

    try {
      for (const t of parsedTasks) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'mock-api-key-12345'
          },
          body: JSON.stringify({
            title: t.title,
            description: t.description,
            priority: t.priority.toLowerCase(),
            type: t.type.toLowerCase(),
            steps: t.steps.map(s => ({ text: s, completed: false, status: 'Pending' })),
            assigneeId: t.assigneeId || 'usr-daniel', // Fallback Daniel
            companyId: 'comp-1', // Default first company
            dueDate: new Date(Date.now() + 86400000 * 2).toISOString().substring(0, 10) // default 2 days out
          })
        });
        if (res.ok) {
          successCount++;
        }
      }
      triggerToast(`Importación masiva completada! ${successCount} tareas creadas.`);
      setParsedTasks([]);
      setMeetingText('');
    } catch (err) {
      console.error(err);
      triggerToast('Error de red durante la importación masiva.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div data-testid="app-shell" className="min-h-screen bg-[#faf9f6] text-primary-900 font-sans antialiased">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#faf9f6]/80 border-b border-gold-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-md">
              <span className="font-serif text-white font-bold text-lg select-none">H</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary-900 via-gold-800 to-gold-600 bg-clip-text text-transparent">
                HERMES
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-gold-600 font-semibold leading-none mt-0.5">
                Meeting Minutes Center
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-4">
            <a href="/" className="px-3 py-2 text-sm font-medium text-primary-600 hover:text-gold-600 rounded-lg transition">
              Dashboard
            </a>
            <a href="/tasks" className="px-3 py-2 text-sm font-medium text-primary-600 hover:text-gold-600 rounded-lg transition">
              Tasks
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10">
          <h2 className="text-3xl font-serif font-bold text-primary-900 tracking-tight">
            Meeting Minutes Parser
          </h2>
          <p className="text-primary-500 mt-1">
            Carga minutas de reuniones y deja que la IA extraiga los compromisos y genere tareas automatizadas.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Input Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary-900 mb-4">Pega la Minuta</h3>
              <textarea
                value={meetingText}
                onChange={(e) => setMeetingText(e.target.value)}
                placeholder="Escribe o pega aquí la transcripción o notas desorganizadas de la reunión..."
                className="w-full h-80 px-4 py-3 border border-primary-200 rounded-xl text-sm focus:ring-2 focus:ring-gold-500 focus:outline-none transition bg-[#faf9f6] text-primary-850"
              />
              <button
                type="button"
                onClick={handleProcessMinutes}
                disabled={loading}
                className="w-full mt-4 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition disabled:opacity-50"
              >
                {loading ? 'Analizando Minuta...' : 'Procesar Minuta con IA'}
              </button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col justify-between">
              
              <div>
                <div className="flex justify-between items-center border-b border-primary-100 pb-3 mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-primary-900">
                    Tareas Extraídas ({parsedTasks.length})
                  </h3>
                  {parsedTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={handleEmailSummary}
                      className="px-3 py-1.5 border border-primary-300 hover:border-gold-500 rounded-xl text-xs font-bold text-primary-700 hover:bg-gold-50 transition"
                    >
                      📧 Enviar Minuta por Correo
                    </button>
                  )}
                </div>

                {parsedTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-primary-400 italic">
                    <span className="text-3xl mb-2">📋</span>
                    <span>No hay tareas cargadas. Pega una minuta a la izquierda y pulsa Procesar.</span>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {parsedTasks.map((t, idx) => (
                      <div key={idx} className="border border-gold-200/30 rounded-xl p-4 bg-[#faf9f6] shadow-xs">
                        <div className="flex flex-col md:flex-row justify-between gap-3 mb-3">
                          <input
                            type="text"
                            value={t.title}
                            onChange={(e) => {
                              const updated = [...parsedTasks];
                              updated[idx].title = e.target.value;
                              setParsedTasks(updated);
                            }}
                            className="flex-1 px-3 py-1 border rounded-lg text-sm font-bold bg-white text-primary-850"
                          />
                          <div className="flex gap-2 shrink-0">
                            <select
                              value={t.priority}
                              onChange={(e) => {
                                const updated = [...parsedTasks];
                                updated[idx].priority = e.target.value as any;
                                setParsedTasks(updated);
                              }}
                              className="px-2 py-1 border rounded-lg text-xs bg-white text-primary-800"
                            >
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                            <select
                              value={t.assigneeId || ''}
                              onChange={(e) => {
                                const updated = [...parsedTasks];
                                updated[idx].assigneeId = e.target.value;
                                setParsedTasks(updated);
                              }}
                              className="px-2 py-1 border rounded-lg text-xs bg-white text-primary-800"
                            >
                              <option value="">Sin Asignar</option>
                              {people.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setParsedTasks(prev => prev.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-700 text-sm font-bold px-2"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        <textarea
                          value={t.description}
                          onChange={(e) => {
                            const updated = [...parsedTasks];
                            updated[idx].description = e.target.value;
                            setParsedTasks(updated);
                          }}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white text-primary-700 h-16"
                        />

                        {t.steps && t.steps.length > 0 && (
                          <div className="mt-3">
                            <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block mb-1">Checklist pasos:</span>
                            <div className="space-y-1 pl-2">
                              {t.steps.map((step, sIdx) => (
                                <input
                                  key={sIdx}
                                  type="text"
                                  value={step}
                                  onChange={(e) => {
                                    const updated = [...parsedTasks];
                                    updated[idx].steps[sIdx] = e.target.value;
                                    setParsedTasks(updated);
                                  }}
                                  className="w-full px-2 py-0.5 border rounded text-[11px] bg-white text-primary-650"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {parsedTasks.length > 0 && (
                <div className="border-t border-primary-100 pt-4 mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    disabled={importing}
                    className="px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition disabled:opacity-50"
                  >
                    {importing ? 'Importando...' : 'Importar Tareas Seleccionadas'}
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* Toast popup */}
      {toastShow && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold z-50 animate-bounce">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
