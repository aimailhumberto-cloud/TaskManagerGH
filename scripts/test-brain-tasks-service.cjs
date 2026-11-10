const path = require('path');

async function testApi() {
  const { getUnifiedBrainTasks, askDotsTask, rescheduleBrainTask, completeBrainTask } = require('../src/lib/smjBrainService');
  
  const res = getUnifiedBrainTasks();
  console.log('Summary:', res.summary);
  console.log('Distributors count:', res.distributors.length);
  res.distributors.forEach(d => {
    console.log(` - ${d.name} (${d.countryCode}): Quota ${d.complianceRate}% [${d.status}] | ${d.pendingTasksCount} pending | next: ${d.nextFollowupDate}`);
  });
  
  console.log('First 3 tasks:');
  res.tasks.slice(0, 3).forEach(t => {
    console.log(` - [${t.id}] ${t.title} (${t.countryCode}) [${t.priority}] due: ${t.dueDate}`);
  });

  // Test ask DOTS on a task
  const firstTask = res.tasks[0];
  console.log('\nTesting askDotsTask on:', firstTask.id);
  const dotsRes = askDotsTask(firstTask.id, 'Por favor preparar reporte de análisis preliminar.', 'Chairman');
  console.log('DOTS Result:', dotsRes);
}

testApi().catch(console.error);
