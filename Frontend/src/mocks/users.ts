import type { MockUser } from '../types/models.ts'

export const mockUsers: MockUser[] = [
  {
    id: 'user-admin',
    name: 'Naveen Babu',
    email: 'anil@saipradeepika.in',
    password: 'admin123',
    role: 'admin',
    flatNumber: null,
    phone: '9848000001',
  },
  {
    id: 'user-ravi',
    name: 'Harish Naidu',
    email: 'ravi@saipradeepika.in',
    password: 'owner123',
    role: 'owner',
    flatNumber: '201',
    phone: '9848022222',
  },
  {
    id: 'user-meera',
    name: 'Pooja Shah',
    email: 'meera@saipradeepika.in',
    password: 'tenant123',
    role: 'tenant',
    flatNumber: '201',
    phone: '9848033333',
  },
]
