/** Search ?creatorType= value for "all professional creators" (same as the backend's). */
export const ALL_PROFESSIONAL_CREATORS = 'all-professional';

/**
 * Same rule as the server: creator types count only for professional
 * creators (cards show the types only then).
 */
export function matchesCreatorType(creator: any, creatorType: string): boolean {
  if (!creatorType) return true;
  if (!creator?.professionalStatus) return false;
  if (creatorType === ALL_PROFESSIONAL_CREATORS) return true;
  const wanted = creatorType.trim().toLowerCase();
  return (creator.creatorTypes || []).some((t: unknown) => String(t || '').trim().toLowerCase() === wanted);
}
