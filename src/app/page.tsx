import React from 'react';
import { dbService } from '@/services/dbService';
import DashboardClient from './DashboardClient';

// Ensure this page is rendered dynamically on every request
export const revalidate = 0;

export default async function Page() {
  // Load tasks, team members, companies, and the AI agent queue on the server
  const [tasks, people, queue, companies] = await Promise.all([
    dbService.getTasks(),
    dbService.getPeople(),
    dbService.getQueue(),
    dbService.getCompanies(),
  ]);

  return (
    <DashboardClient
      initialTasks={tasks}
      initialPeople={people}
      initialQueue={queue}
      initialCompanies={companies}
    />
  );
}
