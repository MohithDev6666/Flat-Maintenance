import dayjs from 'dayjs'
import type { Role } from '../types/models.ts'

/** ₹1,500 for whole rupees; ₹1,500.50 when there are paise, so split shares show exactly. */
export function formatINR(amount: number): string {
  const hasPaise = Math.round(Math.abs(amount) * 100) % 100 !== 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(amount)
}

export function formatDate(value: string): string {
  return dayjs(value).format('DD-MM-YYYY')
}

export function formatDateTime(value: string): string {
  return dayjs(value).format('DD-MM-YYYY HH:mm')
}

export function formatMonth(month: string): string {
  return dayjs(`${month}-01`).format('MMMM YYYY')
}

export function formatRole(role: Role): string {
  if (role === 'admin') return 'Admin'
  if (role === 'owner') return 'Owner'
  return 'Tenant'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function firstName(name: string): string {
  return name.split(' ')[0] ?? name
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== 10) return phone
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
}

/** "Sai Pradeepika Residency" → title "Sai Pradeepika", subtitle "Residency". */
export function splitBuildingName(name: string): { title: string; subtitle: string } {
  const words = name.trim().split(/\s+/)
  if (words.length < 2) return { title: name, subtitle: '' }
  return { title: words.slice(0, -1).join(' '), subtitle: words[words.length - 1] ?? '' }
}

export function greeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
