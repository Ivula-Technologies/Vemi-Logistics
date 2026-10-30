import { z } from "zod";
import { TRUCK_TYPE_KEYS } from "@/lib/pricing";
import { CARGO_TYPES, DOCUMENT_KINDS, PICKUP_WINDOWS } from "@/lib/trips";
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
const checkbox = z.string().optional().transform((value) => value === "on" || value === "true");
const optionalCoordinate = (limit: number) => z.string().trim().transform((value, ctx) => {
  if (!value) return null;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number) || Math.abs(number) > limit) { ctx.addIssue({ code: "custom", message: "Pick the spot on the map again." }); return z.NEVER; }
  return number;
});
const optionalWholeKes = (min: number, max: number, message: string) => z.string().trim().transform((value, ctx) => {
  if (!value) return null;
  const number = Number(value.replace(/[,\s]/g, ""));
  if (!Number.isInteger(number) || number < min || number > max) { ctx.addIssue({ code: "custom", message }); return z.NEVER; }
  return number;
});

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
  pickupWindow: z.enum(Object.keys(PICKUP_WINDOWS) as [keyof typeof PICKUP_WINDOWS, ...(keyof typeof PICKUP_WINDOWS)[]]).catch("anytime"),
  originLat: optionalCoordinate(90),
  originLng: optionalCoordinate(180),
  destinationLat: optionalCoordinate(90),
  destinationLng: optionalCoordinate(180),
  instantBook: checkbox,
  requireCodes: checkbox,
  insure: checkbox,
  partLoad: checkbox,
  declaredValue: optionalWholeKes(1000, 100_000_000, "Enter the value of the goods in KES (at least 1,000)."),
  favouritesHours: z.coerce.number().int().refine((value) => [0, 1, 3, 6, 12].includes(value)).catch(0),
  copiedFrom: z.string().uuid().nullable().catch(null),
  savePickupAs: optionalText(60),
  saveDropoffAs: optionalText(60),
}).refine((value) => value.originId !== value.destinationId, { path: ["destinationId"], message: "Pickup and drop-off must be different places." })
  .refine((value) => !value.insure || value.declaredValue !== null, { path: ["declaredValue"], message: "Enter the value of the goods to add cargo cover." });

export const LOAD_FIELDS = ["originId", "originDetail", "destinationId", "destinationDetail", "pickupDate", "cargoType", "cargoDescription", "weightTonnes", "truckType", "price", "notes",
  "pickupName", "pickupPhone", "dropoffName", "dropoffPhone", "pickupWindow", "originLat", "originLng", "destinationLat", "destinationLng", "instantBook", "requireCodes", "insure", "partLoad",
  "declaredValue", "favouritesHours", "copiedFrom", "savePickupAs", "saveDropoffAs"] as const;

export const MAX_STOPS = 5;
export const stopSchema = z.object({
  placeId: z.string().min(1, "Choose the town for this stop."),
  kind: z.enum(["drop", "pickup"]).catch("drop"),
  detail: optionalText(200),
  name: optionalText(120),
  phone: optionalKenyanPhone,
});

export const savedPlaceSchema = z.object({
  label: z.string().trim().min(1, "Give it a name, like Main warehouse.").max(60),
  placeId: z.string().min(1, "Choose the town."),
  detail: optionalText(200),
  contactName: optionalText(120),
  contactPhone: optionalKenyanPhone,
});

export const chargeSchema = z.object({
  tripId: z.string().uuid(),
  kind: z.enum(["extra_stop", "loading", "other"]),
  amount: z.coerce.number().int("Whole shillings only.").min(100, "At least KES 100.").max(1_000_000),
  note: z.string().trim().min(5, "Explain the charge to the shipper.").max(300),
});

export const businessSchema = z.object({
  legalName: z.string().trim().min(2, "Enter the registered business name.").max(160),
  kraPin: z.string().trim().toUpperCase().transform((value) => value || null).refine((value) => value === null || /^[A-Z]\d{9}[A-Z]$/.test(value), "A KRA PIN looks like P051234567X."),
  billingEmail: z.string().trim().transform((value) => value || null).refine((value) => value === null || /^\S+@\S+\.\S+$/.test(value), "Enter a valid email."),
  billingPhone: optionalKenyanPhone,
});

export const promoSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, "3 to 20 letters and numbers."),
  description: optionalText(200),
  kind: z.enum(["percent", "amount"]),
  value: z.coerce.number().int().positive("Enter the discount."),
  maxDiscount: optionalWholeKes(1, 10_000_000, "Enter a whole number of shillings."),
  maxUses: optionalWholeKes(1, 1_000_000, "Enter a whole number."),
  minPrice: optionalWholeKes(0, 20_000_000, "Enter a whole number of shillings."),
  expiresOn: z.string().trim().transform((value) => value || null),
  firstTripOnly: checkbox,
  active: checkbox,
}).refine((value) => value.kind !== "percent" || value.value <= 100, { path: ["value"], message: "A percentage is 100 at most." });

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
