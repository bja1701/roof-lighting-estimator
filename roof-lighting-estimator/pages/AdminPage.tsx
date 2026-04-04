import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';
import SharedLayout from '../components/SharedLayout';

interface UserRow {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  subscription_tier: 'free' | 'retainer' | 'paid';
  estimates_used: number;
  role: 'user' | 'admin';
  created_at: string;
}

interface FeedbackRow {
  id: string;
  user_id: string | null;
  rating: number | null;
  message: string;
  page: string | null;
  created_at: string;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [tab, setTab] = useState<'users' | 'feedback'>('users');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/'); return; }
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: userData }, { data: fbData }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('feedback').select('*').order('created_at', { ascending: false }),
    ]);
    setUsers(userData ?? []);
    setFeedback(fbData ?? []);
    setLoading(false);
  };

  const handleTierChange = async (userId: string, tier: UserRow['subscription_tier']) => {
    setSavingId(userId);
    await supabase.from('profiles').update({ subscription_tier: tier }).eq('id', userId);
    setUsers(u => u.map(x => x.id === userId ? { ...x, subscription_tier: tier } : x));
    setSavingId(null);
  };

  const stats = {
    total: users.length,
    free: users.filter(u => u.subscription_tier === 'free').length,
    retainer: users.filter(u => u.subscription_tier === 'retainer').length,
    paid: users.filter(u => u.subscription_tier === 'paid').length,
  };

  const tierChip = (tier: string) => {
    const map: Record<string, string> = {
      free: 'bg-surface-container text-on-surface-variant',
      retainer: 'bg-tertiary-container/30 text-tertiary',
      paid: 'bg-secondary-container text-on-secondary-container',
    };
    return `text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${map[tier] ?? map.free}`;
  };

  return (
    <SharedLayout>
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="font-headline font-black text-5xl tracking-tight text-on-surface mb-2">Admin</h1>
            <p className="text-lg text-on-surface-variant">User management, tier control, and feedback inbox.</p>
          </div>
          <span className="text-[10px] font-label uppercase tracking-widest text-primary font-bold bg-primary-container/10 px-3 py-1.5 rounded-full">
            Admin Panel
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-10">
          {[
            { label: 'Total Users', value: stats.total, cls: 'text-on-surface' },
            { label: 'Free Tier', value: stats.free, cls: 'text-on-surface-variant' },
            { label: 'Retainer', value: stats.retainer, cls: 'text-tertiary' },
            { label: 'Paid', value: stats.paid, cls: 'text-secondary' },
          ].map(s => (
            <div key={s.label} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/10">
              <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-2">{s.label}</p>
              <p className={`text-3xl font-headline font-bold ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex bg-surface-container-low p-1 rounded-lg w-fit mb-6">
          {(['users', 'feedback'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-medium rounded-md capitalize transition-all ${tab === t ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
            Loading…
          </div>
        ) : tab === 'users' ? (
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low">
                <tr>
                  {['User', 'Company', 'Tier', 'Estimates', 'Joined'].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-[10px] font-label font-bold uppercase tracking-wider text-on-surface-variant">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-outline-variant/10 hover:bg-surface-container-low transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-on-surface">{u.full_name ?? '—'}</p>
                      <p className="text-xs text-on-surface-variant">{u.email ?? '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">{u.company_name ?? '—'}</td>
                    <td className="px-5 py-4">
                      <select
                        value={u.subscription_tier}
                        onChange={e => handleTierChange(u.id, e.target.value as UserRow['subscription_tier'])}
                        disabled={savingId === u.id}
                        className="bg-surface-container-low border-none rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
                      >
                        <option value="free">Free</option>
                        <option value="retainer">Retainer</option>
                        <option value="paid">Paid</option>
                      </select>
                    </td>
                    <td className="px-5 py-4 text-on-surface">{u.estimates_used}</td>
                    <td className="px-5 py-4 text-xs text-on-surface-variant">
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p className="text-center py-10 text-on-surface-variant">No users yet.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {feedback.length === 0 && <p className="text-center py-10 text-on-surface-variant">No feedback yet.</p>}
            {feedback.map(f => (
              <div key={f.id} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/10">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-0.5">
                    {f.rating && [1,2,3,4,5].map(s => (
                      <span key={s} className={`material-symbols-outlined text-lg ${s <= f.rating! ? 'text-primary-container' : 'text-outline-variant'}`} style={{ fontVariationSettings: `'FILL' ${s <= f.rating! ? 1 : 0}` }}>star</span>
                    ))}
                  </div>
                  <span className="text-xs text-on-surface-variant">{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-on-surface">{f.message}</p>
                {f.page && <p className="text-xs text-on-surface-variant mt-1.5">Page: {f.page}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </SharedLayout>
  );
}
