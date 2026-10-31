import type { CategoryTag, ExpenseCategory } from '../types/models.ts'

function category(id: string, name: string, defaultTag: CategoryTag, description: string): ExpenseCategory {
  return { id, name, defaultTag, description, status: 'Active' }
}

export const mockCategories: ExpenseCategory[] = [
  category('cat-electricity', 'Common electricity', 'Tenant', 'Lights, lift, and pump power for common areas.'),
  category('cat-water', 'Water', 'Tenant', 'Municipal water and tanker top-ups.'),
  category('cat-watchman', 'Watchman', 'Tenant', 'Watchman salary.'),
  category('cat-cleaning', 'Cleaning', 'Tenant', 'Common-area cleaning and supplies.'),
  category('cat-garbage', 'Garbage', 'Tenant', 'Garbage collection.'),
  category('cat-repairs', 'Minor repairs', 'Tenant', 'Small fixes such as taps, bulbs, and switches.'),
  category('cat-motor', 'Motor running/maintenance', 'Tenant', 'Routine motor servicing.'),
  category('cat-structural', 'Structural repair', 'Owner', 'Cracks, beams, and other structural work.'),
  category('cat-painting', 'Painting', 'Owner', 'Interior and exterior painting of common areas.'),
  category('cat-waterproof', 'Waterproofing', 'Owner', 'Terrace and wall waterproofing.'),
  category('cat-lift', 'Lift/Motor replacement', 'Owner', 'Replacing the lift or the water motor.'),
  category('cat-equipment', 'New equipment', 'Owner', 'New fixtures or machines for the building.'),
  category('cat-legal', 'Legal/Property', 'Owner', 'Legal, registration, and property tax work.'),
  category('cat-other', 'Other', 'Other', 'Anything else. Choose Owner or Tenant when adding.'),
]
