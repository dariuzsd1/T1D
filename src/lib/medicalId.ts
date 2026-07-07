/**
 * Medical ID / emergency card types + helpers (CLAUDE.md §7-V2 / Audit 2 #6:
 * "emergency/travel mode + medical-ID card accessible without login").
 *
 * Stored one-row-per-user in `medical_profiles` under RLS. The user may opt in to
 * a read-only PUBLIC copy reachable at /id/<public_token> without logging in — so
 * a first responder can see it on a locked phone. That public read goes through
 * the `get_public_medical_id` security-definer function (see supabase/setup.sql),
 * never a direct anon table read.
 */

/** The full editable profile (the owner's view). */
export interface MedicalProfile {
  fullName: string
  dateOfBirth: string | null
  bloodType: string
  diagnosis: string
  insulinTypes: string
  devices: string
  allergies: string
  emergencyContactName: string
  emergencyContactPhone: string
  doctorName: string
  doctorPhone: string
  notes: string
  isPublic: boolean
  /** Unguessable token for the public link; null until the row exists. */
  publicToken: string | null
}

/** Row shape as stored in Postgres (snake_case). */
export interface MedicalProfileRow {
  full_name: string | null
  date_of_birth: string | null
  blood_type: string | null
  diagnosis: string | null
  insulin_types: string | null
  devices: string | null
  allergies: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  doctor_name: string | null
  doctor_phone: string | null
  notes: string | null
  is_public: boolean | null
  public_token: string | null
}

/** The subset returned by get_public_medical_id() for the no-login card. */
export interface PublicMedicalId {
  full_name: string | null
  blood_type: string | null
  diagnosis: string | null
  insulin_types: string | null
  devices: string | null
  allergies: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  doctor_name: string | null
  doctor_phone: string | null
  notes: string | null
}

/** A sensible empty profile for first-time setup. The notes default to the
 *  single most useful emergency instruction for someone with T1D. */
export function emptyProfile(): MedicalProfile {
  return {
    fullName: '',
    dateOfBirth: null,
    bloodType: '',
    diagnosis: 'Type 1 Diabetes',
    insulinTypes: '',
    devices: '',
    allergies: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    doctorName: '',
    doctorPhone: '',
    notes:
      'If I am confused, unconscious, or seizing, treat for LOW blood sugar: ' +
      'give fast sugar or glucagon and call 911.',
    isPublic: false,
    publicToken: null,
  }
}

export function rowToProfile(r: MedicalProfileRow): MedicalProfile {
  return {
    fullName: r.full_name ?? '',
    dateOfBirth: r.date_of_birth,
    bloodType: r.blood_type ?? '',
    diagnosis: r.diagnosis ?? '',
    insulinTypes: r.insulin_types ?? '',
    devices: r.devices ?? '',
    allergies: r.allergies ?? '',
    emergencyContactName: r.emergency_contact_name ?? '',
    emergencyContactPhone: r.emergency_contact_phone ?? '',
    doctorName: r.doctor_name ?? '',
    doctorPhone: r.doctor_phone ?? '',
    notes: r.notes ?? '',
    isPublic: r.is_public ?? false,
    publicToken: r.public_token,
  }
}

/** Map the editable profile to an upsert payload (snake_case). `user_id` is added
 *  by the caller. `public_token` is left to the DB default on first insert. */
export function profileToRow(p: MedicalProfile): Record<string, unknown> {
  return {
    full_name: p.fullName.trim() || null,
    date_of_birth: p.dateOfBirth || null,
    blood_type: p.bloodType.trim() || null,
    diagnosis: p.diagnosis.trim() || null,
    insulin_types: p.insulinTypes.trim() || null,
    devices: p.devices.trim() || null,
    allergies: p.allergies.trim() || null,
    emergency_contact_name: p.emergencyContactName.trim() || null,
    emergency_contact_phone: p.emergencyContactPhone.trim() || null,
    doctor_name: p.doctorName.trim() || null,
    doctor_phone: p.doctorPhone.trim() || null,
    notes: p.notes.trim() || null,
    is_public: p.isPublic,
  }
}

// The travel checklist + TSA note used to live here as English string constants;
// they're now translation keys (travel.item1..8, travel.tsaNote) rendered
// directly with t() in the medical-id page, so they follow the active language.
