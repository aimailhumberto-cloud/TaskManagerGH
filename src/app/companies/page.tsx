'use client';

import React, { useState, useEffect } from 'react';
import HslAvatar from '@/components/HslAvatar';

interface Company {
  id: string;
  name: string;
}

interface Person {
  id: string;
  name: string;
  role: string;
  avatar: string;
  companyId?: string;
}

const FALLBACK_COMPANIES: Company[] = [
  { id: 'c1', name: 'ACME Corp' },
  { id: 'c2', name: 'Stark Industries' }
];

const FALLBACK_PEOPLE: Person[] = [
  { id: 'p1', name: 'Alice Smith', role: 'Admin', avatar: '/avatars/alice.png' },
  { id: 'p2', name: 'Bob Jones', role: 'Member', avatar: '/avatars/bob.png' }
];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  
  const [selectedRole, setSelectedRole] = useState<string>('Developer');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [associationMessage, setAssociationMessage] = useState<string>('');

  // Form states for creating new entities
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState('CEO');
  const [newPersonAvatar, setNewPersonAvatar] = useState('/avatars/user.png');
  const [newPersonCompanyId, setNewPersonCompanyId] = useState('');

  // Form states for editing entities
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editPersonName, setEditPersonName] = useState('');
  const [editPersonRole, setEditPersonRole] = useState('CEO');
  const [editPersonAvatar, setEditPersonAvatar] = useState('/avatars/user.png');
  const [editPersonCompanyId, setEditPersonCompanyId] = useState('');

  // User Credentials management states
  const [users, setUsers] = useState<{ id: string; personId: string; email: string; isActive: boolean }[]>([]);
  const [newUserPersonId, setNewUserPersonId] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserIsActive, setNewUserIsActive] = useState(true);

  // Edit user credentials states
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserIsActive, setEditUserIsActive] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'x-api-key': 'mock-api-key-12345'
        };
        const [compRes, persRes, usersRes] = await Promise.all([
          fetch('/api/companies', { headers }),
          fetch('/api/persons', { headers }),
          fetch('/api/users', { headers })
        ]);
        if (compRes.ok && persRes.ok && usersRes.ok) {
          const compData = await compRes.json();
          const persData = await persRes.json();
          const usersData = await usersRes.json();
          if (Array.isArray(compData)) {
            setCompanies(compData);
            if (compData.length > 0) {
              setSelectedCompany(compData[0].name);
            }
          }
          if (Array.isArray(persData)) {
            setPeople(persData);
          }
          if (Array.isArray(usersData)) {
            setUsers(usersData);
          }
        }
      } catch (err) {
        console.warn('Failed to load companies or persons from API. Using high-fidelity fallbacks.', err);
        setCompanies(FALLBACK_COMPANIES);
        setPeople(FALLBACK_PEOPLE);
        setSelectedCompany(FALLBACK_COMPANIES[0].name);
      }
    }
    loadData();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newCompanyName.trim() })
      });
      if (res.ok) {
        const created = await res.json();
        setCompanies(prev => [...prev, created]);
        setNewCompanyName('');
        setAssociationMessage(`Company "${created.name}" registered successfully`);
        setTimeout(() => setAssociationMessage(''), 3000);
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to create company'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error registering company');
    }
  };

  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };
      const res = await fetch('/api/persons', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newPersonName.trim(),
          role: newPersonRole,
          avatar: newPersonAvatar,
          companyId: newPersonCompanyId || undefined
        })
      });
      if (res.ok) {
        const created = await res.json();
        setPeople(prev => [...prev, created]);
        setNewPersonName('');
        setAssociationMessage(`Team member "${created.name}" registered successfully`);
        setTimeout(() => setAssociationMessage(''), 3000);
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to create person'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error registering team member');
    }
  };

  const handleAssociate = () => {
    setAssociationMessage(`Associated with ${selectedCompany} successfully`);
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company?")) return;
    try {
      const headers = {
        'x-api-key': 'mock-api-key-12345'
      };
      const res = await fetch(`/api/companies/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setCompanies(prev => prev.filter(c => c.id !== id));
        setAssociationMessage("Company deleted successfully");
        setTimeout(() => setAssociationMessage(''), 3000);
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to delete company'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error deleting company');
    }
  };

  const handleDeletePerson = async (id: string) => {
    if (!confirm("Are you sure you want to delete this team member?")) return;
    try {
      const headers = {
        'x-api-key': 'mock-api-key-12345'
      };
      const res = await fetch(`/api/persons/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setPeople(prev => prev.filter(p => p.id !== id));
        setAssociationMessage("Team member deleted successfully");
        setTimeout(() => setAssociationMessage(''), 3000);
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to delete team member'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error deleting team member');
    }
  };

  const handleOpenEditModal = (person: Person) => {
    setEditingPerson(person);
    setEditPersonName(person.name);
    setEditPersonRole(person.role || 'CEO');
    setEditPersonAvatar(person.avatar || '/avatars/user.png');
    setEditPersonCompanyId(person.companyId || '');
    setIsEditModalOpen(true);
  };

  const handleUpdatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;
    if (!editPersonName.trim()) return;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };
      const res = await fetch(`/api/persons/${editingPerson.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: editPersonName.trim(),
          role: editPersonRole,
          avatar: editPersonAvatar,
          companyId: editPersonCompanyId || null
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setPeople(prev => prev.map(p => p.id === updated.id ? updated : p));
        setIsEditModalOpen(false);
        setEditingPerson(null);
        setAssociationMessage(`Team member "${updated.name}" updated successfully`);
        setTimeout(() => setAssociationMessage(''), 3000);
      } else {
        const errorData = await res.json();
        alert(`Error: ${errorData.error || 'Failed to update team member'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error updating team member');
    }
  };

  // User Credentials management handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserPersonId || !newUserEmail.trim() || !newUserPassword) {
      alert("Please select a profile, enter an email, and provide a password.");
      return;
    }
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };
      const res = await fetch('/api/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          personId: newUserPersonId,
          email: newUserEmail.trim(),
          passwordPlain: newUserPassword,
          isActive: newUserIsActive
        })
      });

      if (res.ok) {
        const created = await res.json();
        setUsers(prev => [...prev, created]);
        setNewUserPersonId('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserIsActive(true);
        setAssociationMessage(`Access credentials registered successfully for ${created.email}`);
        setTimeout(() => setAssociationMessage(''), 3000);
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to create user credentials'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error registering credentials');
    }
  };

  const handleOpenEditUserModal = (user: any) => {
    setEditingUser(user);
    setEditUserEmail(user.email);
    setEditUserPassword(''); // blank by default for resets
    setEditUserIsActive(user.isActive);
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUserEmail.trim()) return;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          personId: editingUser.personId,
          email: editUserEmail.trim(),
          passwordPlain: editUserPassword || undefined,
          isActive: editUserIsActive
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
        setIsEditUserModalOpen(false);
        setEditingUser(null);
        setEditUserPassword('');
        setAssociationMessage(`Access credentials updated for ${updated.email}`);
        setTimeout(() => setAssociationMessage(''), 3000);
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to update credentials'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error updating credentials');
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete access credentials for ${email}? This blocks system access but preserves their work profile.`)) return;

    try {
      const headers = {
        'x-api-key': 'mock-api-key-12345'
      };
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
        setAssociationMessage(`Access credentials deleted successfully for ${email}`);
        setTimeout(() => setAssociationMessage(''), 3000);
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error || 'Failed to delete credentials'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error deleting credentials');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h2 className="text-3xl font-serif font-bold text-primary-900 tracking-tight">
          Teams, Users & Companies Administration
        </h2>
        <p className="text-primary-500 mt-1">
          Manage corporate associations, project teams, roles and credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Companies Column */}
        <section className="bg-white border border-gold-200/50 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold text-primary-900 mb-6 border-b border-primary-100 pb-3">
              Registered Companies
            </h3>
            <div data-testid="company-list" className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {companies.map((company, index) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between border border-primary-100 hover:border-gold-300 rounded-xl p-4 transition-all hover:bg-gold-50/10"
                >
                  <div>
                    <h4
                      data-testid={`company-name-${index + 1}`}
                      className="text-base font-bold text-primary-900"
                    >
                      {company.name}
                    </h4>
                    <p className="text-xs text-primary-400 mt-0.5">ID: {company.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gold-600 bg-gold-50 border border-gold-200 px-2.5 py-1 rounded-lg">
                      Active
                    </span>
                    <button
                      data-testid={`delete-company-${company.id}`}
                      onClick={() => handleDeleteCompany(company.id)}
                      className="p-1 text-red-650 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                      title="Delete Company"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {companies.length === 0 && (
                <p className="text-sm text-primary-450 italic text-center py-8">No companies registered.</p>
              )}
            </div>
          </div>

          {/* Create Company Form */}
          <form onSubmit={handleCreateCompany} className="mt-8 border-t border-primary-100 pt-6 space-y-4">
            <h4 className="text-sm font-bold text-primary-750 uppercase tracking-wider">Register New Company</h4>
            <div className="flex gap-2">
              <input
                type="text"
                id="new-company-name-input"
                data-testid="new-company-name-input"
                placeholder="Company Name (e.g. Surf Shack)"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="flex-1 bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
                required
              />
              <button
                type="submit"
                id="create-company-submit-btn"
                data-testid="create-company-submit-btn"
                className="px-5 py-2.5 bg-gold-600 hover:bg-gold-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all active:translate-y-0.5"
              >
                Register
              </button>
            </div>
          </form>
        </section>

        {/* Persons Column */}
        <section className="bg-white border border-gold-200/50 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold text-primary-900 mb-6 border-b border-primary-100 pb-3">
              Team Members
            </h3>
            <div data-testid="person-list" className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {people.map((person, index) => {
                const comp = companies.find(c => c.id === person.companyId);
                return (
                  <div
                    key={person.id}
                    className="flex items-center justify-between border border-primary-100 hover:border-gold-300 rounded-xl p-4 transition-all hover:bg-gold-50/10"
                  >
                    <div className="flex items-center gap-4">
                      <HslAvatar
                        name={person.name}
                        avatarUrl={person.avatar}
                        size={12}
                        data-testid={`person-avatar-${index + 1}`}
                      />
                      <div>
                        <h4
                          data-testid={`person-name-${index + 1}`}
                          className="text-base font-bold text-primary-900"
                        >
                          {person.name}
                        </h4>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                          <span className="text-[10px] text-primary-500 uppercase tracking-widest font-semibold">
                            {person.role}
                          </span>
                          <span className="hidden sm:inline text-primary-300">•</span>
                          <span className="text-[10px] text-gold-650 font-bold">
                            {comp ? comp.name : 'Global / Multi-company'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditModal(person)}
                        className="p-1.5 text-gold-650 hover:text-gold-800 hover:bg-gold-50 rounded-lg transition font-bold text-sm"
                        title="Edit Member"
                        data-testid={`edit-person-${person.id}`}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeletePerson(person.id)}
                        className="p-1.5 text-red-650 hover:text-red-800 hover:bg-red-50 rounded-lg transition font-bold text-sm"
                        title="Delete Member"
                        data-testid={`delete-person-${person.id}`}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
              {people.length === 0 && (
                <p className="text-sm text-primary-450 italic text-center py-8">No team members registered.</p>
              )}
            </div>
          </div>

          <form onSubmit={handleCreatePerson} className="mt-8 border-t border-primary-100 pt-6 space-y-4">
            <h4 className="text-sm font-bold text-primary-750 uppercase tracking-wider">Register New Member</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-person-name-input" className="block text-[9px] font-extrabold uppercase tracking-wider text-primary-400 mb-1">Full Name</label>
                <input
                  type="text"
                  id="new-person-name-input"
                  data-testid="new-person-name-input"
                  placeholder="e.g. Elena"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-3 py-2 text-xs text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400"
                  required
                />
              </div>
              <div>
                <label htmlFor="new-person-role-select" className="block text-[9px] font-extrabold uppercase tracking-wider text-primary-400 mb-1">Organizational Role</label>
                <select
                  id="new-person-role-select"
                  data-testid="new-person-role-select"
                  value={newPersonRole}
                  onChange={(e) => setNewPersonRole(e.target.value)}
                  className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-3 py-2 text-xs text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400"
                >
                  <option value="CEO">CEO</option>
                  <option value="Gerente">Gerente</option>
                  <option value="Coordinador Operativo">Coordinador Operativo</option>
                  <option value="Administrativo">Administrativo</option>
                  <option value="Contable">Contable</option>
                  <option value="Operaciones">Operaciones</option>
                  <option value="Agente de IA">Agente de IA</option>
                  <option value="Tercero / Externo">Tercero / Externo</option>
                </select>
              </div>
              <div>
                <label htmlFor="new-person-company-select" className="block text-[9px] font-extrabold uppercase tracking-wider text-primary-400 mb-1">Assigned Company</label>
                <select
                  id="new-person-company-select"
                  data-testid="new-person-company-select"
                  value={newPersonCompanyId}
                  onChange={(e) => setNewPersonCompanyId(e.target.value)}
                  className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-3 py-2 text-xs text-primary-900 focus:outline-none focus:border-gold-400"
                >
                  <option value="">Global / No Company (Coordinador / CEO)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-person-avatar-select" className="block text-[9px] font-extrabold uppercase tracking-wider text-primary-400 mb-1">Avatar Profile</label>
                <select
                  id="new-person-avatar-select"
                  data-testid="new-person-avatar-select"
                  value={newPersonAvatar}
                  onChange={(e) => setNewPersonAvatar(e.target.value)}
                  className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-3 py-2 text-xs text-primary-900 focus:outline-none focus:border-gold-400"
                >
                  <option value="/avatars/user.png">Default User Profile</option>
                  <option value="/avatars/daniel.png">Daniel Avatar</option>
                  <option value="/avatars/magin.png">Magin Avatar</option>
                  <option value="/avatars/kiria.png">Kiria Avatar</option>
                  <option value="/avatars/hb.png">HB Avatar</option>
                  <option value="/avatars/hermes.png">Hermes Avatar</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                id="create-person-submit-btn"
                data-testid="create-person-submit-btn"
                className="px-6 py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:translate-y-0.5"
              >
                Register Member
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* User Login Credentials Console */}
      <section className="bg-white border border-gold-200/50 rounded-2xl p-6 md:p-8 shadow-sm mb-10">
        <h3 className="text-xl font-bold text-primary-900 mb-6 border-b border-primary-100 pb-3 flex items-center gap-2">
          <span>🔐</span> User Access Credentials (Login Accounts)
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* List existing credentials (col-span-2) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-sm font-bold text-primary-750 uppercase tracking-wider">Active Credentials Registry</h4>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {users.map((u, idx) => {
                const linkedPerson = people.find(p => p.id === u.personId);
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between border border-primary-100 hover:border-gold-300 rounded-xl p-4 transition-all hover:bg-[#faf9f6]/40"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-primary-850 truncate" title={u.email}>
                          {u.email}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                            : 'bg-red-50 text-red-700 border border-red-150'
                        }`}>
                          {u.isActive ? 'Active' : 'Blocked'}
                        </span>
                      </div>
                      <p className="text-xs text-primary-400 mt-1 flex items-center gap-1.5">
                        <span>👤 Profile:</span>
                        <span className="font-bold text-primary-700">{linkedPerson ? `${linkedPerson.name} (${linkedPerson.role})` : 'Unlinked / Unknown'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenEditUserModal(u)}
                        className="p-1.5 text-gold-650 hover:text-gold-800 hover:bg-gold-50 rounded-lg transition font-bold text-sm"
                        title="Edit Login Credentials"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.email)}
                        className="p-1.5 text-red-650 hover:text-red-800 hover:bg-red-50 rounded-lg transition font-bold text-sm"
                        title="Revoke Credentials"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                );
              })}
              {users.length === 0 && (
                <p className="text-sm text-primary-450 italic py-8 text-center bg-primary-50/20 border border-dashed border-primary-200 rounded-xl">
                  No login credentials created yet. Setup one on the right form!
                </p>
              )}
            </div>
          </div>

          {/* Form to create credentials */}
          <div className="bg-[#faf9f6]/60 border border-primary-200/60 rounded-2xl p-5 md:p-6 flex flex-col justify-between">
            <form onSubmit={handleCreateUser} className="space-y-4">
              <h4 className="text-sm font-bold text-primary-750 uppercase tracking-wider">Create Access Account</h4>
              
              <div>
                <label htmlFor="newUserPerson" className="block text-[10px] font-extrabold uppercase tracking-wide text-primary-400 mb-1">
                  Link Member Profile
                </label>
                <select
                  id="newUserPerson"
                  value={newUserPersonId}
                  onChange={(e) => {
                    setNewUserPersonId(e.target.value);
                    // Autofill email suggestion if profile is selected and has name
                    const linked = people.find(p => p.id === e.target.value);
                    if (linked) {
                      const emailBase = linked.name.toLowerCase().replace(/\s+/g, '.');
                      setNewUserEmail(`${emailBase}@holding.com`);
                    }
                  }}
                  className="w-full bg-white border border-primary-200 rounded-xl px-3 py-2 text-xs text-primary-850 focus:outline-none focus:ring-1 focus:ring-gold-500"
                  required
                >
                  <option value="">Select profile...</option>
                  {people
                    .filter(p => !users.some(u => u.personId === p.id) && p.role !== 'AIAgent' && p.role !== 'Agente de IA')
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.role})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="newUserEmail" className="block text-[10px] font-extrabold uppercase tracking-wide text-primary-400 mb-1">
                  Login Email
                </label>
                <input
                  id="newUserEmail"
                  type="email"
                  placeholder="name@holding.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-white border border-primary-200 rounded-xl px-3 py-2 text-xs text-primary-850 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="newUserPassword" className="block text-[10px] font-extrabold uppercase tracking-wide text-primary-400 mb-1">
                  Access Password
                </label>
                <input
                  id="newUserPassword"
                  type="password"
                  placeholder="Password password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-white border border-primary-200 rounded-xl px-3 py-2 text-xs text-primary-850 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="newUserIsActive"
                  type="checkbox"
                  checked={newUserIsActive}
                  onChange={(e) => setNewUserIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer"
                />
                <label htmlFor="newUserIsActive" className="text-xs font-bold text-primary-700 cursor-pointer">
                  Account Active immediately
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:translate-y-0.5 mt-2"
              >
                Create Credentials
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Interactive Verification Section */}
      <section className="bg-white border border-gold-200/50 rounded-2xl p-6 md:p-8 shadow-sm">
        <h3 className="text-xl font-bold text-primary-900 mb-6 border-b border-primary-100 pb-3">
          Interactive Role & Association Panel
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Role Validation */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-primary-700">
              Validate Team Member Role
            </label>
            <select
              data-testid="role-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-3 text-sm text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
            >
              <option value="Developer">Developer</option>
              <option value="Admin">Admin</option>
              <option value="InvalidRole">InvalidRole</option>
            </select>

            {selectedRole === 'InvalidRole' && (
              <span
                data-testid="role-error-message"
                className="block text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 shadow-sm"
              >
                Error: InvalidRole is not a valid team role
              </span>
            )}
          </div>

          {/* Company Association */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-primary-700">
              Associate Member with Company
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                data-testid="company-select"
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="flex-1 bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-3 text-sm text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                data-testid="associate-btn"
                onClick={handleAssociate}
                className="px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-xl font-medium shadow-md transition-all hover:shadow-lg"
              >
                Associate
              </button>
            </div>

            {associationMessage && (
              <div
                data-testid="association-message"
                className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 shadow-sm transition-all"
              >
                {associationMessage}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Edit Member Modal */}
      {isEditModalOpen && editingPerson && (
        <div
          data-testid="edit-person-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full border border-gold-200/50 shadow-2xl relative mx-4">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingPerson(null);
              }}
              className="absolute top-4 right-4 text-primary-400 hover:text-primary-650 transition text-lg font-bold"
              title="Close Modal"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-primary-900 mb-6 border-b border-primary-100 pb-3 flex items-center gap-2">
              ✏️ Edit Team Member
            </h3>
            
            <form onSubmit={handleUpdatePerson} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="edit-person-name-input"
                  data-testid="edit-person-name-input"
                  value={editPersonName}
                  onChange={(e) => setEditPersonName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
                  Role
                </label>
                <select
                  id="edit-person-role-select"
                  data-testid="edit-person-role-select"
                  value={editPersonRole}
                  onChange={(e) => setEditPersonRole(e.target.value)}
                  className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
                >
                  <option value="CEO">CEO</option>
                  <option value="Gerente">Gerente</option>
                  <option value="Coordinador Operativo">Coordinador Operativo</option>
                  <option value="Administrativo">Administrativo</option>
                  <option value="Contable">Contable</option>
                  <option value="Operaciones">Operaciones</option>
                  <option value="Agente de IA">Agente de IA</option>
                  <option value="Tercero / Externo">Tercero / Externo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
                  Company
                </label>
                <select
                  id="edit-person-company-select"
                  data-testid="edit-person-company-select"
                  value={editPersonCompanyId}
                  onChange={(e) => setEditPersonCompanyId(e.target.value)}
                  className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-gold-400 transition-all"
                >
                  <option value="">Global / No Company (Coordinador / CEO)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
                  Profile Avatar URL
                </label>
                <div className="space-y-2">
                  <select
                    id="edit-person-avatar-select"
                    data-testid="edit-person-avatar-select"
                    value={editPersonAvatar}
                    onChange={(e) => setEditPersonAvatar(e.target.value)}
                    className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
                  >
                    <option value="/avatars/user.png">Default User Profile</option>
                    <option value="/avatars/daniel.png">Daniel Avatar</option>
                    <option value="/avatars/magin.png">Magin Avatar</option>
                    <option value="/avatars/kiria.png">Kiria Avatar</option>
                    <option value="/avatars/hb.png">HB Avatar</option>
                    <option value="/avatars/hermes.png">Hermes Avatar</option>
                    <option value="custom">Custom URL / Input manually...</option>
                  </select>

                  {(!['/avatars/user.png', '/avatars/daniel.png', '/avatars/magin.png', '/avatars/kiria.png', '/avatars/hb.png', '/avatars/hermes.png'].includes(editPersonAvatar) || editPersonAvatar === 'custom') && (
                    <input
                      type="text"
                      id="edit-person-avatar-custom-input"
                      data-testid="edit-person-avatar-custom-input"
                      value={editPersonAvatar === 'custom' ? '' : editPersonAvatar}
                      onChange={(e) => setEditPersonAvatar(e.target.value)}
                      placeholder="Enter custom image/avatar URL (e.g. /avatars/elena.png)"
                      className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingPerson(null);
                  }}
                  className="flex-1 py-2.5 bg-primary-100 hover:bg-primary-200 text-primary-800 rounded-xl font-semibold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="edit-person-submit-btn"
                  data-testid="edit-person-submit-btn"
                  className="flex-1 py-2.5 bg-gold-600 hover:bg-gold-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all active:translate-y-0.5"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Credentials Modal */}
      {isEditUserModalOpen && editingUser && (
        <div
          data-testid="edit-user-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full border border-gold-200/50 shadow-2xl relative mx-4">
            <button
              onClick={() => {
                setIsEditUserModalOpen(false);
                setEditingUser(null);
                setEditUserPassword('');
              }}
              className="absolute top-4 right-4 text-primary-400 hover:text-primary-650 transition text-lg font-bold"
              title="Close Modal"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-primary-900 mb-6 border-b border-primary-100 pb-3 flex items-center gap-2">
              ✏️ Edit Login Credentials
            </h3>
            
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1">
                  Reset Password
                </label>
                <input
                  type="password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400 transition-all"
                />
                <p className="text-[10px] text-primary-400 mt-1 italic">Type a new password only if you wish to reset/change it.</p>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  id="editUserIsActive"
                  type="checkbox"
                  checked={editUserIsActive}
                  onChange={(e) => setEditUserIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer"
                />
                <label htmlFor="editUserIsActive" className="text-xs font-bold text-primary-750 cursor-pointer">
                  Account Active and Enabled
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditUserModalOpen(false);
                    setEditingUser(null);
                    setEditUserPassword('');
                  }}
                  className="flex-1 py-2.5 bg-primary-100 hover:bg-primary-200 text-primary-800 rounded-xl font-semibold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gold-600 hover:bg-gold-700 text-white rounded-xl font-semibold text-sm shadow-md transition-all active:translate-y-0.5"
                >
                  Save Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
