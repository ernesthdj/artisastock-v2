'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, KeyRound, Trash2, Edit } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/providers/AuthProvider';
import { Crumb, Btn, Pill, Select, DataTable, Tabs, type DataTableColumn } from '@/components/ui';
import { InviteCollaboratorSheet } from '@/components/settings/InviteCollaboratorSheet';
import { RoleSheet } from '@/components/settings/RoleSheet';
import { VendeurSheet } from '@/components/pos/VendeurSheet';
import { PinPad } from '@/components/pos/PinPad';

interface Collaborateur {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  role: { id: string; name: string } | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  _count: { users: number };
}

interface Vendeur {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lockedUntil: string | null;
}

export default function TeamPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { user } = useAuth();
  const [tab, setTab] = useState('collaborateurs');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [vendeurSheetOpen, setVendeurSheetOpen] = useState(false);
  const [resetVendeurId, setResetVendeurId] = useState<string | null>(null);
  const [pinPadOpen, setPinPadOpen] = useState(false);

  // ── Collaborateurs (User / Role) ──────────────────────────────────────────

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['team-users'],
    queryFn: async () => {
      const res = await apiClient.get<Collaborateur[]>('/api/v1/users?pageSize=100');
      return res.data;
    },
    enabled: tab === 'collaborateurs',
  });

  const { data: roles } = useQuery({
    queryKey: ['team-roles'],
    queryFn: async () => {
      const res = await apiClient.get<Role[]>('/api/v1/roles?pageSize=100');
      return res.data;
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; roleId?: string; isActive?: boolean }) =>
      apiClient.patch(`/api/v1/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
      toast.success('Collaborateur mis à jour');
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const userColumns: DataTableColumn<Collaborateur>[] = [
    { key: 'name', label: 'Nom', render: (u) => <span className="font-medium text-choco-600">{u.firstName} {u.lastName}</span> },
    { key: 'email', label: 'Email', render: (u) => <span className="text-erp-sm text-neutral-500">{u.email}</span> },
    {
      key: 'role',
      label: 'Rôle',
      render: (u) =>
        can('team.manage') ? (
          <Select
            size="sm"
            value={u.role?.id ?? ''}
            onChange={(e) => updateUserMutation.mutate({ id: u.id, roleId: e.target.value })}
            options={(roles ?? []).map((r) => ({ value: r.id, label: r.name }))}
          />
        ) : (
          <span className="text-erp-sm text-choco-600">{u.role?.name ?? '—'}</span>
        ),
    },
    {
      key: 'status',
      label: 'Statut',
      render: (u) => (
        <button
          onClick={() => can('team.manage') && u.id !== user?.id && updateUserMutation.mutate({ id: u.id, isActive: !u.isActive })}
          disabled={!can('team.manage') || u.id === user?.id || updateUserMutation.isPending}
          className="disabled:cursor-default"
          title={u.id === user?.id ? 'Impossible de désactiver votre propre compte' : undefined}
        >
          <Pill tone={u.isActive ? 'ok' : 'neutral'}>{u.isActive ? '● Actif' : '⏸ Désactivé'}</Pill>
        </button>
      ),
    },
  ];

  // ── Vendeurs POS ───────────────────────────────────────────────────────────

  const { data: vendeurs, isLoading: vendeursLoading } = useQuery({
    queryKey: ['pos-vendeurs'],
    queryFn: async () => {
      const res = await apiClient.get<Vendeur[]>('/api/v1/pos/vendeurs?pageSize=100');
      return res.data;
    },
    enabled: tab === 'vendeurs',
  });

  const toggleVendeurActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/api/v1/pos/vendeurs/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-vendeurs'] });
      toast.success('Vendeur mis à jour');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const isLocked = (v: Vendeur) => !!v.lockedUntil && new Date(v.lockedUntil) > new Date();

  const vendeurColumns: DataTableColumn<Vendeur>[] = [
    { key: 'name', label: 'Nom', render: (v) => <span className="font-medium text-choco-600">{v.firstName} {v.lastName}</span> },
    {
      key: 'status',
      label: 'Statut',
      render: (v) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => can('pos.manage') && toggleVendeurActiveMutation.mutate({ id: v.id, isActive: !v.isActive })}
            disabled={!can('pos.manage') || toggleVendeurActiveMutation.isPending}
            className="disabled:cursor-default"
          >
            <Pill tone={v.isActive ? 'ok' : 'neutral'}>{v.isActive ? '● Actif' : '⏸ Désactivé'}</Pill>
          </button>
          {isLocked(v) && <Pill tone="crit">🔒 Verrouillé</Pill>}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: 40,
      render: (v) =>
        can('pos.manage') ? (
          <button
            onClick={() => setResetVendeurId(v.id)}
            className="p-1 rounded hover:bg-[var(--surface-hover)] text-neutral-400 hover:text-choco-600"
            title="Réinitialiser le PIN"
          >
            <KeyRound size={15} />
          </button>
        ) : null,
    },
  ];

  // ── Rôles ────────────────────────────────────────────────────────────────

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-roles'] });
      toast.success('Rôle supprimé');
    },
    onError: (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue'),
  });

  const roleColumns: DataTableColumn<Role>[] = [
    {
      key: 'name',
      label: 'Nom',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-choco-600">{r.name}</span>
          {r.isSystem && <Pill tone="gold">Système</Pill>}
        </div>
      ),
    },
    { key: 'description', label: 'Description', render: (r) => <span className="text-erp-sm text-neutral-500">{r.description ?? '—'}</span> },
    { key: 'permissions', label: 'Permissions', render: (r) => <span className="text-erp-sm text-neutral-500">{r.permissions.length}</span> },
    { key: 'users', label: 'Utilisateurs', render: (r) => <span className="text-erp-sm text-neutral-500">{r._count.users}</span> },
    {
      key: 'actions',
      label: '',
      width: 70,
      render: (r) =>
        can('team.manage') ? (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => { setEditingRole(r); setRoleSheetOpen(true); }}
              className="p-1 rounded hover:bg-[var(--surface-hover)] text-neutral-400 hover:text-choco-600"
              title="Modifier"
            >
              <Edit size={14} />
            </button>
            {!r.isSystem && (
              <button
                onClick={() => deleteRoleMutation.mutate(r.id)}
                disabled={r._count.users > 0 || deleteRoleMutation.isPending}
                className="p-1 rounded hover:bg-[var(--surface-hover)] text-neutral-400 hover:text-framboise-400 disabled:opacity-30 disabled:cursor-not-allowed"
                title={r._count.users > 0 ? 'Rôle encore assigné' : 'Supprimer'}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <Crumb items={['Dashboard', 'Équipe']} className="mb-1" />
        <h1 className="font-heading text-erp-2xl font-bold text-choco-600">Équipe</h1>
        <p className="text-erp-sm text-neutral-500 mt-0.5">Collaborateurs, vendeurs comptoir et rôles</p>
      </div>

      <div className="flex items-center justify-between">
        <Tabs
          tabs={[
            { key: 'collaborateurs', label: 'Collaborateurs', count: users?.length },
            { key: 'vendeurs', label: 'Vendeurs POS', count: vendeurs?.length },
            { key: 'roles', label: 'Rôles', count: roles?.length },
          ]}
          active={tab}
          onChange={setTab}
        />
        {can('team.manage') && tab === 'collaborateurs' && (
          <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setInviteOpen(true)}>Inviter</Btn>
        )}
        {tab === 'vendeurs' && (
          <div className="flex gap-2">
            <Btn onClick={() => setPinPadOpen(true)}>Tester le PIN</Btn>
            {can('pos.manage') && (
              <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setVendeurSheetOpen(true)}>Ajouter</Btn>
            )}
          </div>
        )}
        {can('team.manage') && tab === 'roles' && (
          <Btn variant="primary" icon={<Plus size={14} />} onClick={() => { setEditingRole(null); setRoleSheetOpen(true); }}>
            Nouveau rôle
          </Btn>
        )}
      </div>

      <div className="bg-neutral-0 rounded-[var(--rx-card)] border border-[var(--line-1)] shadow-[var(--shadow-card)] overflow-hidden">
        {tab === 'collaborateurs' && (
          usersLoading ? (
            <div className="p-4 flex flex-col gap-2.5">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-neutral-100 rounded animate-skeleton" />)}</div>
          ) : (
            <DataTable
              columns={userColumns}
              rows={users ?? []}
              emptyState={<div className="text-center py-12"><p className="text-erp-lg text-neutral-500 mb-1">Aucun collaborateur</p><p className="text-erp-sm text-neutral-400">Invitez le premier membre de votre équipe.</p></div>}
            />
          )
        )}
        {tab === 'vendeurs' && (
          vendeursLoading ? (
            <div className="p-4 flex flex-col gap-2.5">{[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-neutral-100 rounded animate-skeleton" />)}</div>
          ) : (
            <DataTable
              columns={vendeurColumns}
              rows={vendeurs ?? []}
              emptyState={<div className="text-center py-12"><p className="text-erp-lg text-neutral-500 mb-1">Aucun vendeur</p><p className="text-erp-sm text-neutral-400">Ajoutez le premier membre de l&apos;équipe comptoir.</p></div>}
            />
          )
        )}
        {tab === 'roles' && (
          <DataTable
            columns={roleColumns}
            rows={roles ?? []}
            emptyState={<div className="text-center py-12"><p className="text-erp-lg text-neutral-500">Aucun rôle</p></div>}
          />
        )}
      </div>

      <InviteCollaboratorSheet open={inviteOpen} onClose={() => { setInviteOpen(false); queryClient.invalidateQueries({ queryKey: ['team-users'] }); }} />
      <RoleSheet open={roleSheetOpen} onClose={() => { setRoleSheetOpen(false); setEditingRole(null); }} editingRole={editingRole} />
      <VendeurSheet open={vendeurSheetOpen} onClose={() => setVendeurSheetOpen(false)} vendeurId={null} />
      <VendeurSheet open={!!resetVendeurId} onClose={() => setResetVendeurId(null)} vendeurId={resetVendeurId} />
      <PinPad open={pinPadOpen} onClose={() => setPinPadOpen(false)} onVerified={(v) => { toast.success(`Identité vérifiée : ${v.firstName} ${v.lastName}`); setPinPadOpen(false); }} />
    </div>
  );
}
