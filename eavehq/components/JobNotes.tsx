import React, { useEffect, useState, useRef } from 'react';
import { CloudUpload, FileImage, Loader2, Lock, MessageSquare, Paperclip } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { JobNote, JobAttachment } from '../types/client';

const GENERATE_SIGNED_URL = 'https://bsbewwwflqjlxxovjgec.supabase.co/functions/v1/generate-signed-url';
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

// ─── Attachment row ───────────────────────────────────────────────────────────

function AttachmentRow({ attachment, jobUserId }: { attachment: JobAttachment; jobUserId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchUrl = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(GENERATE_SIGNED_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ storage_path: attachment.storage_path }),
      });
      const data = await res.json();
      if (!res.ok || !data.signed_url) throw new Error(data.error ?? 'Failed');
      setUrl(data.signed_url);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchUrl(); }, [attachment.storage_path]);

  const isImage = attachment.mime_type?.startsWith('image/') ?? false;
  const AttachmentIcon = isImage ? FileImage : Paperclip;

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: 'var(--color-surface)' }}>
      <AttachmentIcon size={16} aria-hidden="true" className="shrink-0" style={{ color: 'var(--color-slate)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-ink)' }}>{attachment.filename}</p>
      </div>
      {loading && (
        <Loader2 className="animate-spin" size={16} aria-hidden="true" style={{ color: 'var(--color-slate)' }} />
      )}
      {!loading && loadError && (
        <button
          type="button"
          onClick={() => void fetchUrl()}
          className="text-xs hover:underline min-h-[36px] px-2"
          style={{ color: 'var(--color-destructive)' }}
        >
          Failed, retry
        </button>
      )}
      {!loading && !loadError && url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold hover:underline min-h-[36px] flex items-center"
          style={{ color: 'var(--color-primary)' }}
        >
          Open
        </a>
      )}
    </div>
  );
}

// ─── Note card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  attachments,
  onBodyChange,
  onAttachmentAdded,
  jobId,
  isPrivate,
}: {
  note: JobNote;
  attachments: JobAttachment[];
  onBodyChange: (id: string, body: string) => void;
  onAttachmentAdded: (a: JobAttachment) => void;
  jobId: string;
  isPrivate: boolean;
}) {
  const [body, setBody] = useState(note.body);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save with 800ms debounce
  const handleBodyChange = (value: string) => {
    setBody(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveBody(value), 800);
  };

  const saveBody = async (value: string) => {
    setSaving(true);
    await supabase.from('job_notes').update({ body: value }).eq('id', note.id);
    setSaving(false);
    setSavedAt(Date.now());
    onBodyChange(note.id, value);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadError(null);

    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`File too large (max 50 MB). Note text is saved.`);
      return;
    }

    // Save note body first (non-blocking for upload)
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await saveBody(body);

    setUploading(true);
    const storagePath = `${jobId}/${note.id}/${Date.now()}_${file.name}`;
    const { error: storageError } = await supabase.storage
      .from('job-files')
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (storageError) {
      setUploadError(`Upload failed: ${storageError.message}. Note text is saved.`);
      setUploading(false);
      return;
    }

    const { data: attachData, error: attachError } = await supabase
      .from('job_attachments')
      .insert({
        job_id: jobId,
        note_id: note.id,
        uploader_type: 'contractor',
        storage_path: storagePath,
        filename: file.name,
        mime_type: file.type || null,
      })
      .select()
      .single();

    setUploading(false);
    if (attachError || !attachData) {
      setUploadError(`Saved file but failed to record attachment: ${attachError?.message ?? 'unknown error'}`);
      return;
    }
    onAttachmentAdded(attachData as JobAttachment);
  };

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isPrivate ? (
            <Lock size={16} aria-hidden="true" style={{ color: 'var(--color-warning)' }} />
          ) : (
            <MessageSquare size={16} aria-hidden="true" style={{ color: 'var(--color-primary)' }} />
          )}
          <h3 className="font-bold text-sm" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            {isPrivate ? 'Private Notes' : 'Customer Notes'}
          </h3>
          {!isPrivate && (
            <span
              className="text-[10px] rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider"
              style={{ background: 'rgba(58,99,73,0.1)', color: 'var(--color-primary)' }}
            >
              Visible to client
            </span>
          )}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--color-slate)' }}>
          {saving ? 'Saving…' : savedAt ? 'Saved' : ''}
        </div>
      </div>

      <textarea
        rows={4}
        value={body}
        onChange={e => handleBodyChange(e.target.value)}
        placeholder={isPrivate ? 'Private contractor notes…' : 'Notes visible to the client in their portal…'}
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none transition-all"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-ink)',
        }}
      />

      {/* File attachments (private notes only) */}
      {isPrivate && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-50 min-h-[36px]"
              style={{ color: 'var(--color-slate)' }}
            >
              <Paperclip size={15} aria-hidden="true" />
              {uploading ? 'Uploading…' : 'Attach file / photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
              className="hidden"
              onChange={e => void handleFileChange(e)}
            />
          </div>
          {uploadError && (
            <p className="text-xs mb-2" style={{ color: 'var(--color-destructive)' }}>{uploadError}</p>
          )}
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              {attachments.map(a => (
                <AttachmentRow key={a.id} attachment={a} jobUserId="" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main JobNotes component ──────────────────────────────────────────────────

interface Props {
  jobId: string;
  contractorId: string;
}

export default function JobNotes({ jobId, contractorId }: Props) {
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchNotes();
  }, [jobId]);

  const fetchNotes = async () => {
    setLoading(true);
    const [{ data: notesData }, { data: attachData }] = await Promise.all([
      supabase
        .from('job_notes')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true }),
      supabase
        .from('job_attachments')
        .select('*')
        .eq('job_id', jobId)
        .eq('uploader_type', 'contractor'),
    ]);

    let existingNotes = (notesData ?? []) as JobNote[];

    // Ensure one customer note and one private note always exist
    const hasCustomer = existingNotes.some(n => n.type === 'customer');
    const hasPrivate = existingNotes.some(n => n.type === 'private');

    const toCreate: Array<{ job_id: string; contractor_id: string; type: 'customer' | 'private'; body: string }> = [];
    if (!hasCustomer) toCreate.push({ job_id: jobId, contractor_id: contractorId, type: 'customer', body: '' });
    if (!hasPrivate) toCreate.push({ job_id: jobId, contractor_id: contractorId, type: 'private', body: '' });

    if (toCreate.length > 0) {
      const { data: created } = await supabase.from('job_notes').insert(toCreate).select();
      existingNotes = [...existingNotes, ...(created ?? []) as JobNote[]];
    }

    setNotes(existingNotes);
    setAttachments((attachData ?? []) as JobAttachment[]);
    setLoading(false);
  };

  const handleBodyChange = (id: string, body: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, body } : n));
  };

  const handleAttachmentAdded = (a: JobAttachment) => {
    setAttachments(prev => [...prev, a]);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />
        <div className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />
      </div>
    );
  }

  const customerNote = notes.find(n => n.type === 'customer');
  const privateNote = notes.find(n => n.type === 'private');

  return (
    <div className="space-y-4">
      {customerNote && (
        <NoteCard
          note={customerNote}
          attachments={[]}
          onBodyChange={handleBodyChange}
          onAttachmentAdded={handleAttachmentAdded}
          jobId={jobId}
          isPrivate={false}
        />
      )}
      {privateNote && (
        <NoteCard
          note={privateNote}
          attachments={attachments.filter(a => a.note_id === privateNote.id)}
          onBodyChange={handleBodyChange}
          onAttachmentAdded={handleAttachmentAdded}
          jobId={jobId}
          isPrivate={true}
        />
      )}
    </div>
  );
}

// ─── Client uploads section (contractor view) ─────────────────────────────────

export function ClientUploadsSection({ jobId }: { jobId: string }) {
  const [uploads, setUploads] = useState<JobAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('job_attachments')
      .select('*')
      .eq('job_id', jobId)
      .eq('uploader_type', 'client')
      .then(({ data }) => {
        setUploads((data ?? []) as JobAttachment[]);
        setLoading(false);
      });
  }, [jobId]);

  if (loading) return null;
  if (uploads.length === 0) return null;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <CloudUpload size={16} aria-hidden="true" style={{ color: 'var(--color-slate)' }} />
        <h3 className="font-bold text-sm" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>Client Uploads</h3>
      </div>
      <div className="space-y-1.5">
        {uploads.map(a => (
          <AttachmentRow key={a.id} attachment={a} jobUserId="" />
        ))}
      </div>
    </div>
  );
}
