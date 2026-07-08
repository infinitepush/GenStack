import type { AppConfig, DatabaseTableConfig, FieldConfig } from "@genstack/config-types";
import { type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// ---------------------------------------------------------------------------
// Realistic data pools — NO lorem ipsum, business-believable data only
// ---------------------------------------------------------------------------

const FIRST_NAMES = ["Aarav", "Priya", "Ravi", "Anjali", "Rohan", "Sneha", "Arjun", "Divya", "Vikram", "Pooja", "Rahul", "Meera", "Nikhil", "Sana", "Karan", "John", "Emily", "Michael", "Sarah", "David", "Emma", "James", "Olivia", "Liam", "Sophia"];
const LAST_NAMES = ["Sharma", "Gupta", "Patel", "Singh", "Kumar", "Verma", "Joshi", "Mehta", "Shah", "Reddy", "Smith", "Johnson", "Williams", "Brown", "Jones", "Davis", "Miller", "Wilson", "Moore", "Taylor"];
const DEPARTMENTS = ["Engineering", "Marketing", "Sales", "Finance", "Operations", "Human Resources", "Product", "Design", "Support", "Legal"];
const COMPANIES = ["Acme Corp", "Bright Solutions", "Nova Ventures", "Apex Systems", "TechBridge", "ZeroPoint Labs", "InfraMinds", "CoreLogic", "BlueSky Analytics", "PrismData", "DataVault Inc", "CloudBase", "Synapse Tech"];
const JOB_TITLES = ["Software Engineer", "Product Manager", "Data Analyst", "Marketing Executive", "Sales Manager", "UX Designer", "DevOps Engineer", "Business Analyst", "Finance Manager", "HR Specialist", "Customer Success Manager"];
const CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "New York", "London", "San Francisco", "Berlin", "Tokyo", "Singapore", "Dubai"];
const COUNTRIES = ["India", "United States", "United Kingdom", "Germany", "Japan", "Singapore", "UAE", "Canada", "Australia", "France"];
const STATES = ["Maharashtra", "Karnataka", "Tamil Nadu", "Delhi", "Telangana", "West Bengal", "Gujarat", "California", "New York", "Texas", "Florida"];
const PRODUCTS = ["MacBook Pro 14\"", "Dell Monitor 27\"", "Mechanical Keyboard", "Wireless Mouse", "USB-C Hub", "AirPods Pro", "iPad Mini", "Standing Desk", "Ergonomic Chair", "Webcam HD", "External SSD 1TB", "4K Monitor", "Noise-Cancelling Headphones", "Smart Watch"];
const CATEGORIES = ["Electronics", "Furniture", "Accessories", "Software", "Hardware", "Networking", "Peripherals"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const VEHICLE_TYPES_PARKING = ["car", "suv", "bike", "van", "truck"];
const PARKING_SLOTS = ["A-01", "A-02", "A-03", "B-01", "B-02", "B-03", "C-01", "C-02", "D-01", "D-02", "E-01", "E-02"];
const DOCTORS = ["Dr. Anil Sharma", "Dr. Priya Reddy", "Dr. Ravi Kumar", "Dr. Sunita Joshi", "Dr. James Miller", "Dr. Emily Chen", "Dr. David Wilson"];
const SYMPTOMS = ["Fever and cough", "Severe headache", "Back pain", "Chest discomfort", "Knee injury follow-up", "Routine checkup", "Respiratory infection", "Digestive issues", "Skin rash", "Annual physical exam"];
const URLS = ["https://acme.com", "https://techbridge.io", "https://prismdata.co", "https://zeropoint.dev", "https://inframinds.com", "https://cloudbase.io"];
const PINECODES = ["400001", "110001", "560001", "500001", "600001", "700001", "411001", "380001", "90001", "10001", "77001", "33101"];
const LEAD_STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
const PAYMENT_STATUSES = ["paid", "pending", "overdue", "partial"];
const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
const TICKET_PRIORITIES = ["low", "medium", "high", "critical"];
const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"];
const AVAILABILITY_OPTIONS = ["available", "booked", "maintenance"];
const LOCATIONS = ["Warehouse A", "Warehouse B", "Store Floor", "Distribution Center", "Cold Storage", "Loading Bay"];
const UNIVERSITIES = ["IIT Bombay", "IIT Delhi", "Stanford University", "MIT", "NIT Trichy", "Pune University", "Delhi University", "IIM Ahmedabad"];
const COURSES = ["B.Tech Computer Science", "MBA Finance", "B.Com", "M.Tech", "BBA", "M.Sc Data Science", "B.Sc Physics", "LLB"];

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(daysBack = 180): string {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, daysBack));
  return d.toISOString().split("T")[0] as string;
}

function randomDatetime(daysBack = 90): string {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, daysBack));
  d.setHours(randInt(8, 18), randInt(0, 59));
  return d.toISOString();
}

function randomEmail(firstName: string, lastName: string): string {
  const domains = ["gmail.com", "outlook.com", "company.com", "work.io", "business.co"];
  const fn = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const ln = lastName.toLowerCase().replace(/[^a-z]/g, "");
  return `${fn}.${ln}${randInt(1, 99)}@${pick(domains)}`;
}

function randomPhone(): string {
  const prefixes = ["98", "97", "96", "95", "91", "90", "87", "86", "85"];
  return `+91 ${pick(prefixes)}${randInt(10000000, 99999999)}`;
}

function randomFullName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

// ---------------------------------------------------------------------------
// Smart field-name heuristics — map field names to appropriate generators
// ---------------------------------------------------------------------------

type FieldHintedValue = string | number | boolean;

function inferValueFromFieldName(fieldName: string, field: FieldConfig): FieldHintedValue | undefined {
  const name = fieldName.toLowerCase().replace(/[_\s-]/g, "");

  // --- Name variants ---
  if (/^(name|fullname|customername|patientname|leadname|candidatename|employeename|ownername|drivername|membername|studentname|username|contactname)$/.test(name)) {
    return randomFullName();
  }
  if (/firstname/.test(name)) return pick(FIRST_NAMES);
  if (/lastname|surname/.test(name)) return pick(LAST_NAMES);
  if (/^(doctor|doctorname|physician|specialist)$/.test(name)) return pick(DOCTORS);
  if (/^(company|companyname|organization|employer|firm)$/.test(name)) return pick(COMPANIES);

  // --- Contact ---
  if (/^(email|emailaddress|mail)$/.test(name)) {
    return randomEmail(pick(FIRST_NAMES), pick(LAST_NAMES));
  }
  if (/^(phone|phonenumber|mobile|contact|tel)$/.test(name)) return randomPhone();
  if (/^(url|website|link|profile|linkedin|github|portfolio)$/.test(name)) return pick(URLS);

  // --- Location ---
  if (/^(city|location|hometown)$/.test(name)) return pick(CITIES);
  if (/^(country|nation)$/.test(name)) return pick(COUNTRIES);
  if (/^(state|province|region)$/.test(name)) return pick(STATES);
  if (/^(pincode|postalcode|zipcode|zip)$/.test(name)) return pick(PINECODES);
  if (/^(address|streetaddress)$/.test(name)) return `${randInt(1, 500)} ${pick(["MG Road", "Park Street", "Linking Road", "Main Avenue", "Cross Lane", "Industrial Area"])}`;
  if (/^(warehouse|storage|storagelocation|depot)$/.test(name)) return pick(LOCATIONS);

  // --- Job / HR ---
  if (/^(jobtitle|designation|role|position|title)$/.test(name)) return pick(JOB_TITLES);
  if (/^(department|dept|division|team)$/.test(name)) return pick(DEPARTMENTS);
  if (/^(salary|ctc|package|annualsalary)$/.test(name)) {
    if (field.type === "number") return randInt(400000, 2500000);
    return `₹${(randInt(4, 25) * 100000).toLocaleString("en-IN")}`;
  }
  if (/^(university|college|institution|school)$/.test(name)) return pick(UNIVERSITIES);
  if (/^(course|degree|qualification)$/.test(name)) return pick(COURSES);

  // --- Medical ---
  if (/^(bloodgroup|bloodtype)$/.test(name)) return pick(BLOOD_GROUPS);
  if (/^(symptoms|complaints|notes|diagnosis|reason)$/.test(name)) return pick(SYMPTOMS);
  if (/^(age)$/.test(name)) return randInt(18, 65);

  // --- Products / Inventory ---
  if (/^(productname|itemname|product|item|equipment|asset|goodsname)$/.test(name)) return pick(PRODUCTS);
  if (/^(category|type|itemtype)$/.test(name)) return pick(CATEGORIES);
  if (/^(quantity|qty|stock|units)$/.test(name)) return randInt(1, 500);
  if (/^(reorderlevel|minstock|threshold)$/.test(name)) return randInt(5, 50);
  if (/^(price|unitprice|cost|rate)$/.test(name)) {
    if (field.type === "number") return randFloat(100, 150000, 2);
    return `₹${randInt(100, 150000)}`;
  }

  // --- Business ---
  if (/^(dealvalue|revenue|amount|budget|target|value)$/.test(name)) {
    if (field.type === "number") return randInt(50000, 5000000);
    return `₹${(randInt(50, 500) * 10000).toLocaleString("en-IN")}`;
  }
  if (/^(stage|dealstage|leadstage)$/.test(name)) {
    if (field.type === "enum" && field.options?.length) return pick(field.options);
    return pick(LEAD_STAGES);
  }
  if (/^(description|details|notes|comments|remarks|summary|bio|about)$/.test(name)) {
    return pick(["Excellent performance tracked this quarter.", "Follow-up scheduled for next week.", "Awaiting client approval.", "Priority escalated by manager.", "Documentation in progress.", "Review completed successfully.", "Integration phase underway.", "Deliverable submitted on time."]);
  }

  // --- Parking ---
  if (/^(slotnumber|slot|parkingslot|bay)$/.test(name)) return pick(PARKING_SLOTS);
  if (/^(vehicletype|vehicle)$/.test(name)) return pick(VEHICLE_TYPES_PARKING);
  if (/^(licensenumber|licenseplate|numberplate|registration)$/.test(name)) {
    return `${pick(["MH", "DL", "KA", "TN", "GJ"])}${randInt(10, 99)}${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))}${randInt(1000, 9999)}`;
  }

  // --- Statuses ---
  if (/^(status|paymentstatus)$/.test(name)) {
    if (field.type === "enum" && field.options?.length) return pick(field.options);
    return pick(PAYMENT_STATUSES);
  }
  if (/^(orderstatus)$/.test(name)) {
    if (field.type === "enum" && field.options?.length) return pick(field.options);
    return pick(ORDER_STATUSES);
  }
  if (/^(priority)$/.test(name)) {
    if (field.type === "enum" && field.options?.length) return pick(field.options);
    return pick(TICKET_PRIORITIES);
  }
  if (/^(ticketstatus|issuestatus)$/.test(name)) {
    if (field.type === "enum" && field.options?.length) return pick(field.options);
    return pick(TICKET_STATUSES);
  }
  if (/^(availability|bookingstatus|roomstatus)$/.test(name)) {
    if (field.type === "enum" && field.options?.length) return pick(field.options);
    return pick(AVAILABILITY_OPTIONS);
  }

  // --- Metrics ---
  if (/^(rating|score|stars)$/.test(name)) return randInt(1, 5);
  if (/^(percentage|percent|completion)$/.test(name)) return randInt(0, 100);

  // --- Dates ---
  if (/^(dateofbirth|dob|birthdate)$/.test(name)) {
    const y = randInt(1975, 2000);
    const m = String(randInt(1, 12)).padStart(2, "0");
    const d = String(randInt(1, 28)).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Core value generator for a single field
// ---------------------------------------------------------------------------

function generateFieldValue(field: FieldConfig): FieldHintedValue {
  // First try name-based inference (works for any type)
  const hinted = inferValueFromFieldName(field.name, field);
  if (hinted !== undefined) return hinted;

  // Fall back to type-based generation
  switch (field.type) {
    case "string":
      return `${field.name.replace(/_/g, " ")} ${randInt(1, 999)}`;
    case "text":
      return pick(["Sample entry added for demonstration purposes.", "Generated test record for review.", "Demo data inserted by GenStack sample generator.", "This record is intended for testing and UI validation."]);
    case "number":
      return randInt(1, 1000);
    case "boolean":
      return Math.random() > 0.5;
    case "date":
      return randomDate();
    case "enum":
      return field.options && field.options.length > 0 ? pick(field.options) : "option1";
    default:
      return `${field.name} ${randInt(1, 100)}`;
  }
}

// ---------------------------------------------------------------------------
// Generate a single record payload for a table
// ---------------------------------------------------------------------------

function generateRecord(table: DatabaseTableConfig): Record<string, FieldHintedValue> {
  const record: Record<string, FieldHintedValue> = {};
  for (const field of table.fields) {
    record[field.name] = generateFieldValue(field);
  }
  return record;
}

// ---------------------------------------------------------------------------
// App key derivation (must match runtime-store.ts)
// ---------------------------------------------------------------------------

function appKey(config: AppConfig): string {
  return config.app.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "untitled-app";
}

async function ensureRuntimeUser(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: "runtime@genstack.local" },
    update: {},
    create: { email: "runtime@genstack.local", name: "Runtime Demo User" },
    select: { id: true }
  });
  return user.id;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SampleDataResult {
  tableName: string;
  inserted: number;
}

export interface GenerateSampleDataResult {
  tables: SampleDataResult[];
  totalInserted: number;
}

/**
 * Generates 8–15 realistic sample records for every table in the config.
 * Safe to call multiple times — does not delete existing records.
 */
export async function generateSampleData(config: AppConfig, userId?: string): Promise<GenerateSampleDataResult> {
  const resolvedUserId = userId ?? (await ensureRuntimeUser());
  const key = appKey(config);
  const results: SampleDataResult[] = [];

  for (const table of config.database.tables) {
    const count = randInt(8, 15);
    const rows = Array.from({ length: count }, () =>
      generateRecord(table)
    );

    await prisma.generatedRecord.createMany({
      data: rows.map((data) => ({
        appKey: key,
        tableName: table.name,
        data: data as unknown as Prisma.InputJsonValue,
        userId: resolvedUserId
      }))
    });

    results.push({ tableName: table.name, inserted: count });
  }

  return {
    tables: results,
    totalInserted: results.reduce((sum, r) => sum + r.inserted, 0)
  };
}
