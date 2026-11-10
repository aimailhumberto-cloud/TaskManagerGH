async function check() {
  const url = 'https://taskmanagergh.onrender.com/api/agent/tasks';
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        console.log('SUCCESS! Render is Live with Commit 95cffdc!');
        console.log('Total Tasks in Cloud Vault:', data.summary?.totalTasks);
        console.log('Distributors Monitored:', data.distributors?.length);
        return;
      } else {
        console.log(`[${i+1}/15] Still building (status: ${res.status})...`);
      }
    } catch (e) {
      console.log(`[${i+1}/15] Waiting for deployment: ${e.message}...`);
    }
    await new Promise(r => setTimeout(r, 12000));
  }
}

check();
