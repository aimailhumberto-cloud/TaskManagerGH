"use client";

import { useState, useEffect } from 'react';
import { Task } from '@/services/mockData';

export function useUnreadComments(tasks: Task[], sessionUser: any) {
  const [unreadTasks, setUnreadTasks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const checkUnread = () => {
      const unreadMap: Record<string, boolean> = {};
      
      tasks.forEach(task => {
        if (!task.comments || task.comments.length === 0) {
          unreadMap[task.id] = false;
          return;
        }

        // Find the latest comment
        const latestComment = task.comments.reduce((latest, c) => {
          return !latest || new Date(c.timestamp) > new Date(latest.timestamp) ? c : latest;
        }, task.comments[0]);

        if (!latestComment) {
          unreadMap[task.id] = false;
          return;
        }

        // Check if the latest comment was written by the logged in user
        const isLatestByMe = 
          (sessionUser && (latestComment.personId === sessionUser.personId || latestComment.user === sessionUser.name)) ||
          latestComment.user === 'Tú' || 
          latestComment.user === 'Usuario';

        if (isLatestByMe) {
          unreadMap[task.id] = false;
          return;
        }

        // Compare against last viewed timestamp
        const lastViewed = localStorage.getItem(`hermes_task_viewed_${task.id}`);
        if (!lastViewed) {
          unreadMap[task.id] = true;
        } else {
          unreadMap[task.id] = new Date(latestComment.timestamp) > new Date(lastViewed);
        }
      });

      setUnreadTasks(unreadMap);
    };

    checkUnread();

    // Custom storage listener to sync between tabs/components
    const handleStorageChange = () => {
      checkUnread();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('unread-update', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('unread-update', handleStorageChange);
    };
  }, [tasks, sessionUser]);

  const markAsRead = (taskId: string) => {
    localStorage.setItem(`hermes_task_viewed_${taskId}`, new Date().toISOString());
    window.dispatchEvent(new Event('unread-update'));
  };

  return { unreadTasks, markAsRead };
}
