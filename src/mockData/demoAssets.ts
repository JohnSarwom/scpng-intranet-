/**
 * Mock asset templates for demo data provisioning.
 * These are used to generate 10 unique assets for each user.
 */
export const DEMO_ASSET_TEMPLATES = [
  {
    name: "Business Pro Laptop",
    type: "Laptop",
    brand: "Dell",
    model: "Latitude 7420",
    condition: "Excellent",
    purchase_cost: 1200,
    description: "High-performance business laptop for daily operations."
  },
  {
    name: "UltraWide Monitor 34\"",
    type: "Monitor",
    brand: "Samsung",
    model: "Odyssey G5",
    condition: "New",
    purchase_cost: 450,
    description: "Large curved monitor for productivity and design work."
  },
  {
    name: "Executive Ergonomic Chair",
    type: "Furniture",
    brand: "Herman Miller",
    model: "Aeron",
    condition: "Good",
    purchase_cost: 950,
    description: "Premium ergonomic chair for long-term comfort."
  },
  {
    name: "Corporate Smartphone",
    type: "Mobile",
    brand: "Apple",
    model: "iPhone 13",
    condition: "Excellent",
    purchase_cost: 800,
    description: "Standard issue corporate smartphone for communication."
  },
  {
    name: "Wireless ANC Headset",
    type: "Audio",
    brand: "Sony",
    model: "WH-1000XM4",
    condition: "Excellent",
    purchase_cost: 350,
    description: "Noise-cancelling headphones for focused work and calls."
  },
  {
    name: "Mechanical Keyboard",
    type: "Peripherals",
    brand: "Logitech",
    model: "MX Mechanical",
    condition: "New",
    purchase_cost: 150,
    description: "Tactile wireless mechanical keyboard."
  },
  {
    name: "Precision Wireless Mouse",
    type: "Peripherals",
    brand: "Logitech",
    model: "MX Master 3S",
    condition: "Excellent",
    purchase_cost: 99,
    description: "Advanced wireless mouse for high precision."
  },
  {
    name: "Portable SSD 2TB",
    type: "Storage",
    brand: "SanDisk",
    model: "Extreme Pro",
    condition: "New",
    purchase_cost: 250,
    description: "High-speed external storage for large files."
  },
  {
    name: "Standing Desk Converter",
    type: "Furniture",
    brand: "Varidesk",
    model: "Pro Plus 36",
    condition: "Good",
    purchase_cost: 400,
    description: "Height-adjustable desk converter for improved workspace."
  },
  {
    name: "Webcam 4K",
    type: "Video",
    brand: "Logitech",
    model: "Brio",
    condition: "Excellent",
    purchase_cost: 200,
    description: "High-definition webcam for video conferencing."
  }
];

export const DEMO_MAINTENANCE_TEMPLATES = [
  {
    type: "Preventive",
    description: "Annual hardware checkup and cleaning.",
    status: "Completed",
    technician: "Internal IT Team",
    cost: 50
  },
  {
    type: "Inspection",
    description: "Battery health and safety inspection.",
    status: "Completed",
    technician: "Power Systems Ltd",
    cost: 120
  },
  {
    type: "Corrective",
    description: "Screen replacement due to minor flickering.",
    status: "In Progress",
    technician: "Authorized Service Center",
    cost: 250
  },
  {
    type: "Upgrade",
    description: "RAM and SSD capacity upgrade for performance.",
    status: "Scheduled",
    technician: "IT Services",
    cost: 180
  }
];

export const DEMO_INVOICE_TEMPLATES = [
  {
    vendor: "Dell Inc.",
    amount_multiplier: 1.0, 
    status: "Paid"
  },
  {
    vendor: "Logitech Official",
    amount_multiplier: 1.1,
    status: "Pending"
  },
  {
    vendor: "Samsung Logistics",
    amount_multiplier: 0.95,
    status: "Paid"
  },
  {
    vendor: "Office Supplies Co.",
    amount_multiplier: 1.05,
    status: "Overdue"
  }
];
