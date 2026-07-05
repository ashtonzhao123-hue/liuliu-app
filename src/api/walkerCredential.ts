import { supabase, assertSupabaseConfigured } from '../lib/supabase';
import { WalkerAuthStatus, WalkerServiceStatus, type ID } from '../types';

const CREDENTIAL_BUCKET = 'verification-images';

export interface WalkerCredentialStatus {
  hasStudentCard: boolean;
  studentCardUrl?: string;
}

export async function getWalkerCredentialStatus(userId: ID): Promise<WalkerCredentialStatus> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('walker_auth')
    .select('student_card_url')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const studentCardUrl = data?.student_card_url || undefined;
  return { hasStudentCard: Boolean(studentCardUrl), studentCardUrl };
}

export async function uploadWalkerCredentialImage(userId: ID, file: File): Promise<string> {
  assertSupabaseConfigured();
  const ext = getSafeFileExtension(file.name);
  const path = `${userId}/student-card-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(CREDENTIAL_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || `image/${ext}`,
    upsert: false
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function saveWalkerStudentCredential(userId: ID, studentCardUrl: string): Promise<void> {
  assertSupabaseConfigured();
  const now = new Date().toISOString();
  const { data: existing, error: fetchError } = await supabase
    .from('walker_auth')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  if (existing) {
    const { error } = await supabase
      .from('walker_auth')
      .update({
        student_card_url: studentCardUrl,
        walker_service_status: WalkerServiceStatus.Available,
        updated_at: now
      })
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from('walker_auth').insert({
    user_id: userId,
    school_name: '西安文理学院',
    student_card_url: studentCardUrl,
    living_area_text: '',
    service_radius_km: 3,
    walker_auth_status: WalkerAuthStatus.PendingReview,
    walker_service_status: WalkerServiceStatus.Available,
    exam_status: 1,
    walker_level: 1,
    created_at: now,
    updated_at: now
  });
  if (error) throw new Error(error.message);
}

function getSafeFileExtension(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png' || ext === 'webp' || ext === 'jpg' || ext === 'jpeg') return ext;
  return 'jpg';
}
