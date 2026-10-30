import type { Flat } from '../types/models.ts'

function owner(
  name: string,
  phone: string,
  email: string,
  flatNumber: string,
  emergency: string,
): Flat['owner'] {
  return {
    name,
    phone,
    email,
    address: `Flat ${flatNumber}, Sai Pradeepika Residency, Manikonda, Telangana`,
    emergency,
  }
}

export const flats: Flat[] = [
  {
    number: '101',
    floor: 1,
    owner: owner('Suresh Reddy', '9848101101', 'suresh@saipradeepika.in', '101', 'Padma Reddy · 9848101102'),
    tenant: null,
  },
  {
    number: '102',
    floor: 1,
    owner: owner('Lakshmi Rao', '9848102102', 'lakshmi@saipradeepika.in', '102', 'Ramesh Rao · 9848102103'),
    tenant: null,
  },
  {
    number: '201',
    floor: 2,
    owner: owner('Harish Naidu', '9848022222', 'ravi@saipradeepika.in', '201', 'Latha Naidu · 9848022233'),
    tenant: {
      name: 'Pooja Shah',
      phone: '9848033333',
      email: 'meera@saipradeepika.in',
      occupants: 3,
      moveIn: '2026-06-01',
      moveOut: null,
      agreementEnd: '2027-05-31',
      vehicle: 'TS 09 AB 2145',
      emergency: 'Rekha Shah · 9848033344',
      idProofLabel: 'Aadhaar on file',
    },
  },
  {
    number: '202',
    floor: 2,
    owner: owner('Arjun Das', '9848202202', 'arjun@saipradeepika.in', '202', 'Nila Das · 9848202203'),
    tenant: null,
  },
  {
    number: '301',
    floor: 3,
    owner: owner('Priya Nair', '9848301301', 'priya@saipradeepika.in', '301', 'Anand Nair · 9848301302'),
    tenant: null,
  },
  {
    number: '302',
    floor: 3,
    owner: owner('Kiran Shah', '9848302302', 'kiran@saipradeepika.in', '302', 'Hema Shah · 9848302303'),
    tenant: null,
  },
  {
    number: '401',
    floor: 4,
    owner: owner('Divya Menon', '9848401401', 'divya@saipradeepika.in', '401', 'Rahul Menon · 9848401402'),
    tenant: null,
  },
  {
    number: '402',
    floor: 4,
    owner: owner('Vikram Joshi', '9848402402', 'vikram@saipradeepika.in', '402', 'Sonal Joshi · 9848402403'),
    tenant: null,
  },
]
