export const mapApiToDb = {
  status: (status?: string) => {
    if (!status) return undefined;
    const map: Record<string, 'Pending' | 'In Progress' | 'Completed' | 'Blocked'> = {
      'pending': 'Pending',
      'todo': 'Pending',
      'backlog': 'Pending',
      'in-progress': 'In Progress',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'done': 'Completed',
      'blocked': 'Blocked',
    };
    return map[status.toLowerCase().replace(/[_ ]/g, '-')] || undefined;
  },
  priority: (priority?: string) => {
    if (!priority) return undefined;
    const map: Record<string, 'High' | 'Medium' | 'Low'> = {
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low',
    };
    return map[priority.toLowerCase()] || undefined;
  },
  origin: (origin?: string) => {
    if (!origin) return undefined;
    const map: Record<string, 'Golden Hour' | 'Manual'> = {
      'golden-hour': 'Golden Hour',
      'manual': 'Manual',
    };
    return map[origin.toLowerCase()] || undefined;
  },
  type: (type?: string) => {
    if (!type) return undefined;
    const map: Record<string, 'One-shot' | 'Repetitive' | 'Project'> = {
      'one-shot': 'One-shot',
      'repetitive': 'Repetitive',
      'project': 'Project',
    };
    return map[type.toLowerCase()] || undefined;
  },
  repeatPattern: (pattern?: string) => {
    if (!pattern) return undefined;
    const map: Record<string, 'Daily' | 'Weekly' | 'Monthly'> = {
      'daily': 'Daily',
      'weekly': 'Weekly',
      'monthly': 'Monthly',
    };
    return map[pattern.toLowerCase()] || undefined;
  }
};

export const mapDbToApi = (task: any) => {
  if (!task) return null;
  const statusMap: Record<string, string> = {
    'Pending': 'pending',
    'In Progress': 'in-progress',
    'Completed': 'completed',
    'Blocked': 'blocked'
  };
  const priorityMap: Record<string, string> = {
    'High': 'high',
    'Medium': 'medium',
    'Low': 'low'
  };
  const originMap: Record<string, string> = {
    'Golden Hour': 'golden-hour',
    'Manual': 'manual'
  };
  const typeMap: Record<string, string> = {
    'One-shot': 'one-shot',
    'Repetitive': 'repetitive',
    'Project': 'project'
  };

  return {
    ...task,
    status: statusMap[task.status] || task.status,
    priority: priorityMap[task.priority] || task.priority,
    origin: originMap[task.origin] || task.origin,
    type: typeMap[task.type] || task.type,
    // ensure steps, attachments, and comments are arrays
    steps: Array.isArray(task.steps) ? task.steps : [],
    attachments: Array.isArray(task.attachments) ? task.attachments : [],
    activityLog: Array.isArray(task.activityLog) ? task.activityLog : [],
    comments: Array.isArray(task.comments) ? task.comments : [],
    completedDays: Array.isArray(task.completedDays) ? task.completedDays : [],
  };
};
