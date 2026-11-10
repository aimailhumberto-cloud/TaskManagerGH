const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const vaultDir = path.join(__dirname, '..', 'vault');

function getAllMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseFrontmatterAndBody(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  try {
    const parsed = YAML.parse(match[1]);
    return { frontmatter: parsed || {}, body: match[2].trim() };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

const files = getAllMarkdownFiles(vaultDir);
console.log('Total vault files:', files.length);

const tasks = [];
const todayStr = '2026-11-10';

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const { frontmatter, body } = parseFrontmatterAndBody(content);
  const filename = path.basename(file, '.md');
  const nodeId = frontmatter.id || filename.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const nodeTitle = frontmatter.title || filename;
  const relFile = path.relative(vaultDir, file).replace(/\\/g, '/');

  // 1. Distributor followups and pending tasks
  if (frontmatter.type === 'distributor') {
    if (frontmatter.next_followup_action) {
      tasks.push({
        id: `fu-${nodeId}`,
        title: frontmatter.next_followup_action,
        sourceType: 'distributor',
        sourceFile: relFile,
        sourceNodeId: nodeId,
        sourceNodeTitle: frontmatter.company_name || frontmatter.short_name || nodeTitle,
        country: frontmatter.based_in_country || 'Pan-Regional',
        dueDate: frontmatter.next_followup_date || todayStr,
        priority: 'High',
        status: 'Pending',
        isFollowup: true,
      });
    }
    if (Array.isArray(frontmatter.pending_tasks)) {
      frontmatter.pending_tasks.forEach((pt, idx) => {
        tasks.push({
          id: `pt-${nodeId}-${idx + 1}`,
          title: pt,
          sourceType: 'distributor',
          sourceFile: relFile,
          sourceNodeId: nodeId,
          sourceNodeTitle: frontmatter.company_name || frontmatter.short_name || nodeTitle,
          country: frontmatter.based_in_country || 'Pan-Regional',
          dueDate: frontmatter.next_followup_date || todayStr,
          priority: idx === 0 ? 'High' : 'Medium',
          status: 'Pending',
        });
      });
    }
  }

  // 2. Routines and Projects checklist
  if (frontmatter.type === 'routine' || frontmatter.type === 'project') {
    if (Array.isArray(frontmatter.checklist)) {
      frontmatter.checklist.forEach((item, idx) => {
        tasks.push({
          id: `chk-${nodeId}-${idx + 1}`,
          title: item,
          sourceType: frontmatter.type,
          sourceFile: relFile,
          sourceNodeId: nodeId,
          sourceNodeTitle: nodeTitle,
          dueDate: '2026-11-15',
          priority: frontmatter.priority === 'high' ? 'High' : 'Medium',
          status: 'Pending',
        });
      });
    }
  }

  // 3. Markets
  if (frontmatter.type === 'market' && Array.isArray(frontmatter.pending_tasks)) {
    frontmatter.pending_tasks.forEach((pt, idx) => {
      tasks.push({
        id: `mkt-${nodeId}-${idx + 1}`,
        title: pt,
        sourceType: 'market',
        sourceFile: relFile,
        sourceNodeId: nodeId,
        sourceNodeTitle: frontmatter.country_name || nodeTitle,
        country: frontmatter.country_name,
        dueDate: '2026-11-14',
        priority: 'Medium',
        status: 'Pending',
      });
    });
  }

  // 4. Working Memory
  if (frontmatter.type === 'working_memory') {
    tasks.push({
      id: `wm-${nodeId}`,
      title: frontmatter.title.replace(/^Working Memory:\s*/, ''),
      description: frontmatter.notes || body.slice(0, 150),
      sourceType: 'working_memory',
      sourceFile: relFile,
      sourceNodeId: nodeId,
      sourceNodeTitle: frontmatter.title,
      dueDate: todayStr,
      priority: 'High',
      status: frontmatter.status === 'pulsing' ? 'Pending' : 'In Progress',
      dotsStatus: 'assigned',
    });
  }
}

console.log(`Found ${tasks.length} unified tasks:`);
tasks.forEach(t => console.log(`[${t.sourceType.toUpperCase()}] (${t.dueDate}) [${t.priority}] ${t.sourceNodeTitle}: ${t.title}`));
