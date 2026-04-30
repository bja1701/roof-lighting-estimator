import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SharedLayout from '../components/SharedLayout';
import { Client } from '../types/client';

// ─── CSV Import ───────────────────────────────────────────────────────────────

interface CsvRow {
  name: string;
  email: string;
  phone: string;
  address_street: string;
  address_city: string;
  address_zip: string;
  company_name: string;
  notes: string;
  _raw: string;
  _error?: string;
}

interface MergeCandidate {
  incoming: CsvRow;
  existing: Client;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): { rows: CsvRow[]; headerError?: string } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], headerError: 'CSV must have a header row and at least one data row.' };

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const nameIdx = headers.indexOf('name');
  const emailIdx = headers.indexOf('email');
  const phoneIdx = headers.indexOf('phone');
  const streetIdx = headers.indexOf('address_street');
  const cityIdx = headers.indexOf('address_city');
  const zipIdx = headers.indexOf('address_zip');
  const companyIdx = headers.indexOf('company_name');
  const notesIdx = headers.indexOf('notes');

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = nameIdx >= 0 ? (cols[nameIdx] ?? '') : '';
    const email = emailIdx >= 0 ? (cols[emailIdx] ?? '') : '';
    const row: CsvRow = {
      name,
      email,
      phone: phoneIdx >= 0 ? (cols[phoneIdx] ?? '') : '',
      address_street: streetIdx >= 0 ? (cols[streetIdx] ?? '') : '',
      address_city: cityIdx >= 0 ? (cols[cityIdx] ?? '') : '',
      address_zip: zipIdx >= 0 ? (cols[zipIdx] ?? '') : '',
      company_name: companyIdx >= 0 ? (cols[companyIdx] ?? '') : '',
      notes: notesIdx >= 0 ? (cols[notesIdx] ?? '') : '',
      _raw: lines[i],
    };
    if (!name.trim()) {
      row._error = 'Missing name';
    }
    rows.push(row);
  }
  return { rows };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // CSV import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<number>(0);
  const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
  const [pendingRows, setPendingRows] = useState<CsvRow[]>([]);
  const [mergeResolutions, setMergeResolutions] = useState<Record<string, 'merge' | 'separate'>>({});
  const [showImportResult, setShowImportResult] = useState(false);

  useEffect(() => { void fetchClients(); }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });
    setClients(data ?? []);
    setLoading(false);
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.company_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ── CSV Import flow ──────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = '';

    const { rows, headerError } = parseCsv(text);
    if (headerError) { alert(headerError); return; }

    // Split valid vs errored rows
    const validRows = rows.filter(r => !r._error);
    const errorRows = rows.filter(r => r._error);

    // Check for email collisions against existing clients
    const emailsToCheck = validRows.filter(r => r.email.trim()).map(r => r.email.trim().toLowerCase());
    let existingByEmail: Record<string, Client> = {};
    if (emailsToCheck.length > 0) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .in('email', emailsToCheck);
      (data ?? []).forEach((c: Client) => {
        existingByEmail[c.email!.toLowerCase()] = c;
      });
    }

    const clean: CsvRow[] = [];
    const merges: MergeCandidate[] = [];
    for (const row of validRows) {
      const key = row.email.trim().toLowerCase();
      if (key && existingByEmail[key]) {
        merges.push({ incoming: row, existing: existingByEmail[key] });
      } else {
        clean.push(row);
      }
    }

    const initialErrors = errorRows.map(r => `Row skipped (${r._error}): ${r._raw}`);

    if (merges.length > 0) {
      setMergeCandidates(merges);
      setPendingRows(clean);
      setImportErrors(initialErrors);
      setMergeResolutions({});
      return;
    }

    // No merges — proceed directly
    await runImport(clean, [], {}, initialErrors);
  };

  const handleMergeResolve = (email: string, choice: 'merge' | 'separate') => {
    setMergeResolutions(prev => ({ ...prev, [email]: choice }));
  };

  const allResolved = mergeCandidates.every(mc => mergeResolutions[mc.incoming.email.trim().toLowerCase()]);

  const handleMergeConfirm = async () => {
    if (!allResolved) return;
    await runImport(pendingRows, mergeCandidates, mergeResolutions, importErrors);
    setMergeCandidates([]);
  };

  const runImport = async (
    cleanRows: CsvRow[],
    merges: MergeCandidate[],
    resolutions: Record<string, 'merge' | 'separate'>,
    existingErrors: string[]
  ) => {
    setImporting(true);
    const errors = [...existingErrors];
    let successCount = 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }

    // Insert clean rows
    for (const row of cleanRows) {
      const { error } = await supabase.from('clients').insert({
        contractor_id: user.id,
        name: row.name,
        email: row.email || null,
        phone: row.phone || null,
        address_street: row.address_street || null,
        address_city: row.address_city || null,
        address_zip: row.address_zip || null,
        company_name: row.company_name || null,
        notes: row.notes || null,
      });
      if (error) {
        errors.push(`Failed to import "${row.name}": ${error.message}`);
      } else {
        successCount++;
      }
    }

    // Handle merge decisions
    for (const mc of merges) {
      const key = mc.incoming.email.trim().toLowerCase();
      const resolution = resolutions[key];
      if (resolution === 'merge') {
        // Update existing client with incoming data (non-empty fields win)
        const updates: Partial<Client> = {};
        if (mc.incoming.phone) updates.phone = mc.incoming.phone;
        if (mc.incoming.address_street) updates.address_street = mc.incoming.address_street;
        if (mc.incoming.address_city) updates.address_city = mc.incoming.address_city;
        if (mc.incoming.address_zip) updates.address_zip = mc.incoming.address_zip;
        if (mc.incoming.company_name) updates.company_name = mc.incoming.company_name;
        if (mc.incoming.notes) updates.notes = mc.incoming.notes;
        const { error } = await supabase.from('clients').update(updates).eq('id', mc.existing.id);
        if (error) {
          errors.push(`Merge failed for "${mc.incoming.name}": ${error.message}`);
        } else {
          successCount++;
        }
      } else {
        // Insert as separate record
        const { error } = await supabase.from('clients').insert({
          contractor_id: user.id,
          name: mc.incoming.name,
          email: mc.incoming.email || null,
          phone: mc.incoming.phone || null,
          address_street: mc.incoming.address_street || null,
          address_city: mc.incoming.address_city || null,
          address_zip: mc.incoming.address_zip || null,
          company_name: mc.incoming.company_name || null,
          notes: mc.incoming.notes || null,
        });
        if (error) {
          errors.push(`Failed to import "${mc.incoming.name}": ${error.message}`);
        } else {
          successCount++;
        }
      }
    }

    setImportErrors(errors);
    setImportSuccess(successCount);
    setShowImportResult(true);
    setImporting(false);
    await fetchClients();
  };

  return (
    <SharedLayout>
      <div className="px-4 sm:px-6 md:px-10 py-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-headline text-4xl font-black tracking-tight text-on-surface">Clients</h1>
            <p className="text-on-surface-variant text-sm mt-1">All your client records in one place.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest py-2.5 px-4 font-headline text-sm font-bold text-on-surface shadow-sm transition-colors hover:bg-surface-container-low disabled:opacity-50 min-h-[44px]"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => void handleFileSelect(e)}
            />
          </div>
        </div>

        {/* Search */}
        <div className="mb-5 relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
          <input
            type="text"
            placeholder="Search clients by name, email, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border-none rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-container text-on-surface placeholder:text-on-surface-variant/50 transition-all min-h-[44px]"
          />
        </div>

        {/* Import result banner */}
        {showImportResult && (
          <div className="mb-5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-on-surface text-sm">
                  Import complete — {importSuccess} record{importSuccess !== 1 ? 's' : ''} imported.
                </p>
                {importErrors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {importErrors.map((e, i) => (
                      <li key={i} className="text-xs text-error">{e}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowImportResult(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </div>
        )}

        {/* Client list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface-container-lowest rounded-xl shadow-sm p-4 animate-pulse">
                <div className="h-4 bg-surface-container-low rounded w-1/3 mb-2" />
                <div className="h-3 bg-surface-container-low rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl shadow-sm">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4 block">contacts</span>
            <h3 className="font-headline font-bold text-lg text-on-surface mb-1">No clients yet</h3>
            <p className="text-on-surface-variant text-sm">Import a CSV or create jobs with client info to build your client list.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(client => (
              <button
                key={client.id}
                type="button"
                onClick={() => navigate(`/clients/${client.id}`)}
                className="w-full text-left bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 px-4 py-4 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center gap-2 min-h-[44px]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="font-headline font-bold text-on-surface">{client.name}</span>
                    {client.company_name && (
                      <span className="text-xs text-on-surface-variant bg-surface-container-low rounded-full px-2 py-0.5">{client.company_name}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-on-surface-variant">
                    {client.email && <span>{client.email}</span>}
                    {client.phone && <span>{client.phone}</span>}
                    {(client.address_street || client.address_city) && (
                      <span>{[client.address_street, client.address_city, client.address_zip].filter(Boolean).join(', ')}</span>
                    )}
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant text-lg shrink-0">chevron_right</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Merge popup */}
      {mergeCandidates.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: 'rgba(31,61,44,0.75)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="merge-dialog-title"
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl max-h-[80vh] flex flex-col"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-modal)' }}
          >
            <div className="p-6 overflow-y-auto flex-1">
              <h2 id="merge-dialog-title" className="font-headline text-xl font-bold text-on-surface mb-1">
                Email collision detected
              </h2>
              <p className="text-sm text-on-surface-variant mb-5">
                {mergeCandidates.length} incoming record{mergeCandidates.length !== 1 ? 's' : ''} match{mergeCandidates.length === 1 ? 'es' : ''} an existing client by email. Choose how to handle each.
              </p>
              <div className="space-y-4">
                {mergeCandidates.map(mc => {
                  const key = mc.incoming.email.trim().toLowerCase();
                  const resolution = mergeResolutions[key];
                  return (
                    <div key={key} className="rounded-xl border border-outline-variant/20 p-4">
                      <p className="text-sm font-semibold text-on-surface mb-1">{mc.incoming.name}</p>
                      <p className="text-xs text-on-surface-variant mb-3">{mc.incoming.email} — existing: <span className="font-semibold">{mc.existing.name}</span></p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleMergeResolve(key, 'merge')}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
                            resolution === 'merge'
                              ? 'bg-primary text-white'
                              : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                          }`}
                        >
                          Merge into existing
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMergeResolve(key, 'separate')}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${
                            resolution === 'separate'
                              ? 'bg-primary text-white'
                              : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                          }`}
                        >
                          Keep separate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant/10 flex gap-3">
              <button
                type="button"
                onClick={() => { setMergeCandidates([]); setPendingRows([]); setMergeResolutions({}); }}
                className="flex-1 rounded-lg bg-surface-container-low py-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container min-h-[44px]"
              >
                Cancel import
              </button>
              <button
                type="button"
                onClick={() => void handleMergeConfirm()}
                disabled={!allResolved || importing}
                className="flex-1 rounded-lg bg-primary py-3 text-sm font-headline font-bold text-white disabled:opacity-50 hover:bg-primary/90 transition-colors min-h-[44px]"
              >
                {importing ? 'Importing…' : 'Continue import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SharedLayout>
  );
}
