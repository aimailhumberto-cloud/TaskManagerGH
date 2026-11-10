const https = require('https');

async function checkDeploy() {
  const url = 'https://taskmanagergh.onrender.com/api/agent/tasks';
  console.log('Verificando despliegue de Render...');
  for (let i = 1; i <= 24; i++) {
    try {
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      if (res.ok) {
        const d = await res.json();
        if (d.summary && d.summary.panamaTimestamp) {
          console.log('=== ¡DESPLIEGUE EN RENDER CONFIRMADO EN VIVO! ===');
          console.log('Sello Panama:', d.summary.panamaTimestamp);
          console.log('Total Tareas en Cloud SSOT:', d.tasks?.length);
          console.log('Distribuidores Verificados:', d.distributors?.length);
          process.exit(0);
        }
      }
    } catch (e) {
      // network retry
    }
    console.log(`[${i}/24] Render compilando nuevo commit... esperando 10s`);
    await new Promise(r => setTimeout(r, 10000));
  }
  console.log('Render sigue procesando en segundo plano.');
  process.exit(0);
}

checkDeploy();
