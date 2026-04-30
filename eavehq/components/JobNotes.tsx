import React, { useEffect, useState, useRef } from 'react';
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

  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2">
      <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">
        {isImage ? 'image' : 'attach_file'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-on-surface truncate">{attachment.filename}</p>
      </div>
      {loading && (
        <span className="material-symbols-outlined animate-spin text-base text-on-surface-variant">progress_activity</span>
      )}
      {!loading && loadError && (
        <button
          type="button"
          onClick={() => void fetchUrl()}
          className="text-xs text-error hover:underline min-h-[36px] px-2"
        >
          Failed — retry
        </button>
      )}
      {!loading && !loadError && url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-primary hover:underline min-h-[36px] flex items-center"
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
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-base ${isPrivate ? 'text-amber-500' : 'text-primary'}`}>
            {isPrivate ? 'lock' : 'chat_bubble'}
          </span>
          <h3 className="font-headline font-bold text-sm text-on-surface">
            {isPrivate ? 'Private Notes' : 'Customer Notes'}
          </h3>
          {!isPrivate && (
            <span className="text-[10px] bg-primary-container/20 text-primary rounded-full px-2 py-0.5 font-label uppercase tracking-wider">
              Visible to client
            </span>
          )}
        </div>
        <div className="text-[10px] text-on-surface-variant">
          {saving ? 'Saving…' : savedAt ? 'Saved' : ''}
        </div>
      </div>

      <textarea
        rows={4}
        value={body}
        onChange={e => handleBodyChange(e.target.value)}
        placeholder={isPrivate ? 'Private contractor notes…' : 'Notes visible to the client in their portal…'}
        className="w-full rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-container resize-none transition-all"
      />

      {/* File attachments (private notes only) */}
      {isPrivate && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50 min-h-[36px]"
            >
              <span className="material-symbols-outlined text-base">attach_file</span>
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
            <p className="text-xs text-error mb-2">{uploadError}</p>
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
        <div className="h-24 bg-surface-container-low rounded-xl animate-pulse" />
        <div className="h-24 bg-surface-container-low rounded-xl animate-pulse" />
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
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-on-surface-variant">cloud_upload</span>
        <h3 className="font-headline font-bold text-sm text-on-surface">Client Uploads</h3>
      </div>
      <div className="space-y-1.5">
        {uploads.map(a => (
          <AttachmentRow key={a.id} attachment={a} jobUserId="" />
        ))}
      </div>
    </div>
  );
}
