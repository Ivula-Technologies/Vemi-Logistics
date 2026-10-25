import { z } from "zod";
import { TRUCK_TYPE_KEYS } from "@/lib/pricing";
import { CARGO_TYPES, DOCUMENT_KINDS } from "@/lib/trips";
import { normalizeKenyanPhone } from "@/lib/phone";

const kenyanPhone = z.string().trim().transform((value, ctx) => {
  const phone = normalizeKenyanPhone(value);
  if (!phone) { ctx.addIssue({ code: "custom", message: "Enter a Kenyan mobile number like 0712 345 678." }); return z.NEVER; }
  return phone;
});
const optionalKenyanPhone = z.string().trim().transform((value, ctx) => {
  if (!value) return null;
  const phone = normalizeKenyanPhone(value);
  if (!phone) { ctx.addIssue({ code: "custom", message: "Enter a Kenyan mobile number like 0712 345 678." }); return z.NEVER; }
  return phone;
});
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  role: z.enum(["shipper", "carrier"]),
  fullName: z.string().trim().min(2, "Enter your name.").max(120),
  company: optionalText(160),
  phone: kenyanPhone,
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  terms: z.literal("on", { message: "Accept the terms to continue." }),
});

export const accountSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(120),
  company: optionalText(160),
  phone: kenyanPhone,
});

export const loadSchema = z.object({
  originId: z.string().min(1, "Choose where the goods are."),
  originDetail: optionalText(200),
  destinationId: z.string().min(1, "Choose where they are going."),
  destinationDetail: optionalText(200),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a pickup date."),
  cargoType: z.enum(Object.keys(CARGO_TYPES) as [keyof typeof CARGO_TYPES, ...(keyof typeof CARGO_TYPES)[]]),
  cargoDescription: z.string().trim().min(3, "Describe the goods (what and how packed).").max(500),
  weightTonnes: z.coerce.number().positive("Enter the weight in tonnes.").max(60, "Over 60 t needs a special permit. Split it into two loads."),
  truckType: z.enum(TRUCK_TYPE_KEYS as [string, ...string[]]),
  price: z.coerce.number().int("Whole shillings only.").min(1000, "The minimum is KES 1,000.").max(20_000_000),
  notes: optionalText(1000),
  pickupName: optionalText(120),
  pickupPhone: optionalKenyanPhone,
  dropoffName: optionalText(120),
  dropoffPhone: optionalKenyanPhone,
}).refine((value) => value.originId !== value.destinationId, { path: ["destinationId"], message: "Pickup and drop-off must be different places." });

export const bidSchema = z.object({
  loadId: z.string().uuid(),
  amount: z.coerce.number().int("Whole shillings only.").min(1000, "The minimum is KES 1,000.").max(20_000_000),
  note: optionalText(300),
});

export const carrierSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business or trading name.").max(160),
  baseTown: optionalText(80),
  crossBorder: z.boolean(),
  countries: z.array(z.enum(["KE", "UG", "TZ", "RW", "BI", "SS", "CD", "ET", "ZM"])).min(1, "Choose at least one country."),
  kraPin: z.string().trim().toUpperCase().transform((value) => value || null).refine((value) => value === null || /^[A-Z]\d{9}[A-Z]$/.test(value), "A KRA PIN looks like A012345678B."),
  idNumber: optionalText(20),
  payoutPhone: kenyanPhone,
  payoutName: z.string().trim().min(2, "Enter the name registered on the M-Pesa line.").max(120),
});

export const truckSchema = z.object({
  plate: z.string().trim().toUpperCase().regex(/^[A-Z0-9 ]{4,12}$/, "Enter the number plate, like KDA 123A."),
  truckType: z.enum(TRUCK_TYPE_KEYS as [string, ...string[]]),
  capacityTonnes: z.coerce.number().positive("Enter the capacity in tonnes.").max(80),
  makeModel: optionalText(80),
});

export const driverSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the driver's name.").max(120),
  phone: kenyanPhone,
  licenceNo: optionalText(30),
});

export const documentKindSchema = z.enum(Object.keys(DOCUMENT_KINDS) as [keyof typeof DOCUMENT_KINDS, ...(keyof typeof DOCUMENT_KINDS)[]]);

export { kenyanPhone };
