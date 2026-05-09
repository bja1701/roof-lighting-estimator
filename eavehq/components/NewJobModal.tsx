import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BriefcaseBusiness, X, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ensureProfileRowExists } from '../utils/ensureProfile';

interface Props {
  onCreated: (jobId: string) => void;
  onClose: () => void;
}

type ClientMode = 'create' | 'select';

interface ClientSearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-ink)',
  fontSize: '0.875rem',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--color-slate)',
  marginBottom: '6px',
};

export default function NewJobModal({ onCreated, onClose }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Client picker state
  const [clientMode, setClientMode] = useState<ClientMode>('create');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchClients = useCallback(async (query: string) => {
    if (!user || query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    setSearchFailed(false);
    const safeQuery = query.replace(/[(),]/g, '');
    try {
      const { data, error: searchErr } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .eq('contractor_id', user.id)
        .or(`name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
        .order('name')
        .limit(8);

      if (searchErr) {
        setSearchFailed(true);
        setSearchResults([]);
        setShowDropdown(false);
      } else {
        setSearchResults(data ?? []);
        setShowDropdown((data ?? []).length > 0);
      }
    } catch {
      setSearchFailed(true);
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  }, [user]);

  useEffect(() => {
    if (clientMode !== 'select') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchClients(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, clientMode, searchClients]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleModeChange(mode: ClientMode) {
    setClientMode(mode);
    setSelectedClient(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setSearchFailed(false);
    // Reset create-mode fields when switching back
    if (mode === 'create') {
      setClientName('');
      setClientEmail('');
      setClientPhone('');
    }
  }

  function handleSelectClient(client: ClientSearchResult) {
    setSelectedClient(client);
    setSearchQuery(client.name);
    setShowDropdown(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setSubmitting(true);
    setError('');
    const ensured = await ensureProfileRowExists(user);
    if (!ensured.ok) {
      setSubmitting(false);
      setError(ensured.error ?? 'Your account profile is still syncing. Refresh and try again.');
      return;
    }

    // Determine client fields to write to the job row
    const jobClientName = clientMode === 'select' && selectedClient
      ? selectedClient.name
      : clientName.trim() || null;
    const jobClientEmail = clientMode === 'select' && selectedClient
      ? selectedClient.email
      : clientEmail.trim() || null;
    const jobClientPhone = clientMode === 'select' && selectedClient
      ? selectedClient.phone
      : clientPhone.trim() || null;

    const { data, error: err } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        name: name.trim(),
        address: null,
        client_name: jobClientName,
        client_email: jobClientEmail,
        client_phone: jobClientPhone,
      })
      .select()
      .single();
    if (err) { setSubmitting(false); setError(err.message); return; }

    try {
      if (clientMode === 'select' && selectedClient) {
        // "Select existing" path — just link the existing client_id
        await supabase
          .from('jobs')
          .update({ client_id: selectedClient.id })
          .eq('id', data.id);
      } else {
        // "Create new client" path — existing upsert behavior unchanged
        const trimEmail = clientEmail.trim();
        const trimPhone = clientPhone.trim();
        const trimName = clientName.trim();
        if (trimName || trimEmail || trimPhone) {
          try {
            let clientId: string | null = null;

            if (trimEmail) {
              // Atomic upsert — unique constraint on (contractor_id, email) prevents duplicates
              const { data: upserted } = await supabase
                .from('clients')
                .upsert(
                  {
                    contractor_id: user.id,
                    name: trimName || trimEmail,
                    email: trimEmail,
                    phone: trimPhone || null,
                  },
                  { onConflict: 'contractor_id,email', ignoreDuplicates: false }
                )
                .select('id')
                .single();
              clientId = upserted?.id ?? null;
            } else if (trimPhone) {
              // Atomic upsert — unique constraint on (contractor_id, phone) prevents duplicates
              const { data: upserted } = await supabase
                .from('clients')
                .upsert(
                  {
                    contractor_id: user.id,
                    name: trimName || trimPhone,
                    phone: trimPhone,
                  },
                  { onConflict: 'contractor_id,phone', ignoreDuplicates: false }
                )
                .select('id')
                .single();
              clientId = upserted?.id ?? null;
            } else {
              // Name only — always insert a new client row (no dedup possible on name alone)
              const { data: inserted } = await supabase
                .from('clients')
                .insert({ contractor_id: user.id, name: trimName })
                .select('id')
                .single();
              clientId = inserted?.id ?? null;
            }

            if (clientId) {
              await supabase
                .from('jobs')
                .update({ client_id: clientId })
                .eq('id', data.id);
            }
          } catch {
            // Client upsert failed — job already created, proceed normally
          }
        }
      }

      onCreated(data.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ background: 'rgba(31,61,44,0.75)' }}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >

        <div className="p-7">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(58,99,73,0.1)', color: 'var(--color-primary)' }}
              >
                <BriefcaseBusiness size={18} />
              </div>
              <h2 className="font-bold text-xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
                New Job
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-slate)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-ink)'; e.currentTarget.style.background = 'var(--color-surface)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-slate)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label style={labelStyle}>Job Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Smith Residence"
                style={inputStyle}
              />
            </div>

            <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-slate)' }}>
                Client Info (Optional)
              </p>

              {/* Mode toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => handleModeChange('create')}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg transition-colors"
                  style={{
                    background: clientMode === 'create' ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: clientMode === 'create' ? '#fff' : 'var(--color-slate)',
                    border: `1px solid ${clientMode === 'create' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}
                >
                  Create new client
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('select')}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg transition-colors"
                  style={{
                    background: clientMode === 'select' ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: clientMode === 'select' ? '#fff' : 'var(--color-slate)',
                    border: `1px solid ${clientMode === 'select' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}
                >
                  Select existing client
                </button>
              </div>

              {clientMode === 'create' && (
                <div className="space-y-4">
                  <div>
                    <label style={labelStyle}>Client Name</label>
                    <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Smith" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Client Email</label>
                    <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="john@example.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Client Phone</label>
                    <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(208) 555-0123" style={inputStyle} />
                  </div>
                </div>
              )}

              {clientMode === 'select' && (
                <div className="relative">
                  <label style={labelStyle}>Search by name or email</label>
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--color-slate)' }}
                    />
                    <input
                      ref={searchRef}
                      type="text"
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        if (selectedClient && e.target.value !== selectedClient.name) {
                          setSelectedClient(null);
                        }
                      }}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowDropdown(true);
                      }}
                      placeholder="Type at least 2 characters…"
                      style={{ ...inputStyle, paddingLeft: '34px' }}
                      autoComplete="off"
                    />
                    {searching && (
                      <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                        style={{ color: 'var(--color-slate)' }}
                      >
                        Searching…
                      </span>
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {showDropdown && searchResults.length > 0 && (
                    <div
                      ref={dropdownRef}
                      className="absolute z-10 w-full mt-1 rounded-lg overflow-hidden"
                      style={{
                        background: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        boxShadow: 'var(--shadow-modal)',
                        maxHeight: '240px',
                        overflowY: 'auto',
                      }}
                    >
                      {searchResults.map(client => (
                        <button
                          key={client.id}
                          type="button"
                          className="w-full text-left px-4 py-3 transition-colors"
                          style={{ borderBottom: '1px solid var(--color-border)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          onClick={() => handleSelectClient(client)}
                        >
                          <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>{client.name}</p>
                          {(client.email || client.phone) && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
                              {[client.email, client.phone].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected client confirmation */}
                  {selectedClient && (
                    <div
                      className="mt-2 px-3 py-2 rounded-lg flex items-center justify-between"
                      style={{ background: 'rgba(58,99,73,0.08)', border: '1px solid rgba(58,99,73,0.2)' }}
                    >
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>{selectedClient.name}</p>
                        {(selectedClient.email || selectedClient.phone) && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
                            {[selectedClient.email, selectedClient.phone].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedClient(null); setSearchQuery(''); }}
                        className="ml-2 p-1 rounded"
                        style={{ color: 'var(--color-slate)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-ink)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-slate)')}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Graceful degradation notice when search failed */}
                  {searchFailed && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--color-slate)' }}>
                      Search unavailable — you can still create a new client or proceed without one.
                    </p>
                  )}

                  {/* Hint when query is short */}
                  {!searching && !searchFailed && searchQuery.length > 0 && searchQuery.length < 2 && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--color-slate)' }}>
                      Keep typing to search…
                    </p>
                  )}

                  {/* No results */}
                  {!searching && !searchFailed && searchQuery.length >= 2 && searchResults.length === 0 && !selectedClient && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--color-slate)' }}>
                      No matching clients found.
                    </p>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
              Site address is set automatically when you save an estimate from the map.
            </p>

            {error && (
              <div
                className="px-4 py-3 rounded-lg"
                style={{ background: 'rgba(201,64,64,0.08)', border: '1px solid rgba(201,64,64,0.2)' }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--color-destructive)' }}>{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 text-sm font-medium rounded-lg transition-colors"
                style={{ background: 'var(--color-surface)', color: 'var(--color-slate)', border: '1px solid var(--color-border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-border)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="flex-1 font-bold py-3 rounded-lg transition-all active:scale-95"
                style={{
                  background: submitting || !name.trim() ? 'var(--color-border)' : 'var(--color-accent)',
                  color: submitting || !name.trim() ? 'var(--color-slate)' : '#fff',
                  cursor: submitting || !name.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-display)',
                  boxShadow: submitting || !name.trim() ? 'none' : '0 2px 8px rgba(217,111,10,0.3)',
                }}
              >
                {submitting ? 'Creating…' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
