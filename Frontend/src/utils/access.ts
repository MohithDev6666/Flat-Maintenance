import type { SessionUser } from '../types/models.ts'

export function canSeeFlatPeople(viewer: SessionUser, flatNumber: string): boolean {
  if (viewer.role === 'admin') return true
  return viewer.role === 'owner' && viewer.flatNumber === flatNumber
}

export function canSeeIdProof(viewer: SessionUser, flatNumber: string): boolean {
  return canSeeFlatPeople(viewer, flatNumber)
}

export function canSeeOwnProfile(viewer: SessionUser, flatNumber: string): boolean {
  return viewer.flatNumber === flatNumber
}
