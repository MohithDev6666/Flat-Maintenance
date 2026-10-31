import type { Owner } from '../types/models.ts'

const building = 'Sai Pradeepika Residency, Manikonda, Telangana'

function owner(id: string, name: string, phone: string, email: string, flatNumber: string, emergency: string, address?: string): Owner {
  return {
    id,
    name,
    phone,
    email,
    flatId: `flat-${flatNumber}`,
    // Owners who live in their flat use the flat as their address; owners who rent it out live elsewhere.
    address: address ?? `Flat ${flatNumber}, ${building}`,
    emergency,
  }
}

/** Every one of the 8 flats has one permanent owner. */
export const mockOwners: Owner[] = [
  owner('owner-101', 'Suresh Reddy', '9848101101', 'owner101@flat.com', '101', 'Padma Reddy · 9848101102', '12-4-88, Banjara Hills, Hyderabad'),
  owner('owner-102', 'Lakshmi Rao', '9848102102', 'owner102@flat.com', '102', 'Ramesh Rao · 9848102103'),
  owner('owner-201', 'Harish Naidu', '9848022222', 'harish@saipradeepika.in', '201', 'Latha Naidu · 9848022233', 'Plot 41, Kondapur, Hyderabad'),
  owner('owner-202', 'Arjun Das', '9848202202', 'arjun@saipradeepika.in', '202', 'Nila Das · 9848202203', '7 MG Road, Bengaluru'),
  owner('owner-301', 'Priya Nair', '9848301301', 'priya@saipradeepika.in', '301', 'Anand Nair · 9848301302'),
  owner('owner-302', 'Kiran Shah', '9848302302', 'kiran@saipradeepika.in', '302', 'Hema Shah · 9848302303', '22 Jubilee Hills, Hyderabad'),
  owner('owner-401', 'Divya Menon', '9848401401', 'divya@saipradeepika.in', '401', 'Rahul Menon · 9848401402'),
  owner('owner-402', 'Vikram Joshi', '9848402402', 'vikram@saipradeepika.in', '402', 'Sonal Joshi · 9848402403'),
]
