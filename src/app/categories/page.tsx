'use client';

import React, { useState } from 'react';

interface Folder {
  id: string;
  name: string;
  tasks: string[];
}

const INITIAL_FOLDERS: Folder[] = [
  {
    id: 'frontend',
    name: 'Frontend',
    tasks: ['Task in frontend folder: Align primary CTA button margins', 'Task in frontend folder: Fix input validation error state text']
  },
  {
    id: 'backend',
    name: 'Backend',
    tasks: ['Task in backend folder: Optimize database transactional locks', 'Task in backend folder: Secure company entity associations']
  }
];

export default function CategoriesPage() {
  const [folders, setFolders] = useState<Folder[]>(INITIAL_FOLDERS);
  const [activeFolderId, setActiveFolderId] = useState<string>('frontend');
  const [newFolderName, setNewFolderName] = useState<string>('');

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    const folderId = newFolderName.trim().toLowerCase().replace(/\s+/g, '-');
    
    // Avoid duplicates
    if (folders.some(f => f.id === folderId)) return;

    const newFolder: Folder = {
      id: folderId,
      name: newFolderName.trim(),
      tasks: [`Task in ${folderId} folder: Initialize workspace structures`, `Task in ${folderId} folder: Conduct security audits`]
    };

    setFolders([...folders, newFolder]);
    setActiveFolderId(folderId);
    setNewFolderName('');
  };

  const handleDeleteBackend = () => {
    setFolders(folders.filter(f => f.id !== 'backend'));
    if (activeFolderId === 'backend') {
      setActiveFolderId('frontend');
    }
  };

  const activeFolder = folders.find(f => f.id === activeFolderId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-primary-900 tracking-tight">
            Organizational Folders
          </h2>
          <p className="text-primary-500 mt-1">
            Group your workflow tasks dynamically using premium structural categories.
          </p>
        </div>
        <div className="bg-gold-50 border border-gold-200 px-4 py-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
          <span className="text-xs uppercase tracking-widest text-gold-600 font-bold">Total Folders:</span>
          <span data-testid="folders-count" className="text-lg font-extrabold text-gold-700">
            {folders.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Folders list & creation */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-primary-900 mb-4 border-b border-primary-100 pb-2">
              Folders list
            </h3>
            
            <div className="space-y-2 mb-6">
              {folders.map((folder) => {
                const isActive = folder.id === activeFolderId;
                return (
                  <div
                    key={folder.id}
                    data-testid={`category-folder-${folder.id}`}
                    onClick={() => setActiveFolderId(folder.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-primary-900 border-primary-900 text-white shadow-md'
                        : 'bg-[#faf9f6]/40 border-gold-200/40 text-primary-800 hover:bg-gold-50/40 hover:border-gold-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📁</span>
                      <span className="text-sm font-semibold">{folder.name}</span>
                    </div>

                    {folder.id === 'backend' && (
                      <button
                        data-testid="delete-folder-btn-backend"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBackend();
                        }}
                        className={`p-1.5 rounded-lg border transition-all text-xs font-bold ${
                          isActive
                            ? 'bg-red-950/20 border-red-500/30 text-red-300 hover:bg-red-500 hover:text-white'
                            : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Create new folder */}
            <div className="border-t border-primary-100 pt-5 space-y-3">
              <label className="block text-xs font-bold text-primary-600 uppercase tracking-widest">
                Create new folder
              </label>
              <div className="space-y-3">
                <input
                  data-testid="new-folder-input"
                  type="text"
                  placeholder="e.g. devops, design..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-2.5 text-xs text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
                />
                <button
                  data-testid="add-folder-btn"
                  onClick={handleAddFolder}
                  className="w-full py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
                >
                  + Add Folder
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Active Folder Tasks display */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gold-200/50 rounded-2xl p-6 md:p-8 shadow-sm">
            <h3 className="text-xl font-bold text-primary-900 mb-6 border-b border-primary-100 pb-3 flex items-center gap-2.5">
              <span>📁</span>
              <span>{activeFolder ? activeFolder.name : 'No folder active'}</span>
            </h3>

            {activeFolder && activeFolder.tasks.length > 0 ? (
              <div className="space-y-4">
                {activeFolder.tasks.map((taskText, index) => (
                  <div
                    key={index}
                    data-testid="folder-task-card"
                    className="border border-primary-100 hover:border-gold-300 rounded-xl p-5 hover:bg-gold-50/10 transition-all duration-300 flex items-start gap-4 shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-full bg-gold-50 border border-gold-200 flex items-center justify-center text-gold-600 shrink-0 font-bold text-xs mt-0.5">
                      ✓
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary-900 leading-snug">{taskText}</p>
                      <span className="inline-block text-[10px] font-bold text-gold-600 uppercase tracking-widest bg-gold-50 border border-gold-100 rounded-md px-2 py-0.5 mt-2">
                        Active Category Task
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-primary-400">No tasks in this folder yet.</p>
                <p className="text-xs text-primary-300 mt-1">Assign a task to this folder to see it here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
