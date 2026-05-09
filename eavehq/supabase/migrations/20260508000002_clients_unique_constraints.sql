-- Dedup clients by email (keep earliest created_at per contractor)
DELETE FROM clients a USING clients b
WHERE a.contractor_id = b.contractor_id
  AND a.email = b.email
  AND a.email IS NOT NULL
  AND a.created_at > b.created_at;

-- Dedup clients by phone (keep earliest created_at per contractor)
DELETE FROM clients a USING clients b
WHERE a.contractor_id = b.contractor_id
  AND a.phone = b.phone
  AND a.phone IS NOT NULL
  AND a.created_at > b.created_at;

ALTER TABLE clients
  ADD CONSTRAINT clients_contractor_email_unique UNIQUE (contractor_id, email);

ALTER TABLE clients
  ADD CONSTRAINT clients_contractor_phone_unique UNIQUE (contractor_id, phone);
