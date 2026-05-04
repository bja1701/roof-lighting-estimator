export interface Client {
	id: string;
	contractor_id: string;
	name: string;
	phone: string | null;
	email: string | null;
	address_street: string | null;
	address_city: string | null;
	address_zip: string | null;
	company_name: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface JobNote {
	id: string;
	job_id: string;
	contractor_id: string;
	type: 'customer' | 'private';
	body: string;
	created_at: string;
	updated_at: string;
}

export interface JobAttachment {
	id: string;
	job_id: string;
	note_id: string | null;
	uploader_type: 'contractor' | 'client';
	storage_path: string;
	filename: string;
	mime_type: string | null;
	created_at: string;
}
