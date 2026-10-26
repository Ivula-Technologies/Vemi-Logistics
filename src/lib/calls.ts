import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { startMaskedCall, voiceConfigured } from "@/lib/voice";

export type CallTarget = "shipper" | "carrier" | "driver" | "pickup" | "dropoff";

/** Who each side of a trip may call through Vemi. */
export const CALL_TARGETS: Record<"shipper" | "carrier" | "driver", CallTarget[]> = {
  shipper: ["carrier", "driver"],
  carrier: ["shipper", "driver", "pickup", "dropoff"],
  driver: ["carrier", "pickup", "dropoff"],
};

/** The real number behind a call target, looked up with the service key (it never reaches the caller). */
async function numberFor(tripId: string, target: CallTarget) {
  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("shipper_id, carrier_id, driver_id, load_id, status").eq("id", tripId).single();
  if (!trip || ["awaiting_payment", "cancelled", "completed"].includes(trip.status)) return null;
  if (target === "driver") {
    if (!trip.driver_id) return null;
    const { data } = await admin.from("drivers").select("phone").eq("id", trip.driver_id).single();
    return data?.phone ?? null;
  }
  if (target === "shipper" || target === "carrier") {
    const { data } = await admin.from("profiles").select("phone").eq("id", target === "shipper" ? trip.shipper_id : trip.carrier_id).single();
    return data?.phone?.replace(/^\+/, "") ?? null;
  }
  const { data } = await admin.from("load_contacts").select("pickup_phone, dropoff_phone").eq("load_id", trip.load_id).maybeSingle();
  return (target === "pickup" ? data?.pickup_phone : data?.dropoff_phone) ?? null;
}

/**
 * Starts a masked call: Vemi rings the caller first; when they answer, the voice callback connects them
 * to the other number. Returns an error message, or null when the call is on its way.
 */
export async function startTripCall(tripId: string, requestedBy: "shipper" | "carrier" | "driver", callerPhone: string | null, target: CallTarget) {
  if (!voiceConfigured()) return "Calls through Vemi are not switched on yet. Use the phone number instead.";
  if (!CALL_TARGETS[requestedBy].includes(target)) return "You can't call that person on this trip.";
  if (!callerPhone) return "Add your mobile number to your account first.";
  const callee = await numberFor(tripId, target);
  if (!callee) return "That person's number isn't available for this trip.";
  const admin = createAdminClient();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin.from("voice_calls").select("id", { count: "exact", head: true }).eq("trip_id", tripId).gte("created_at", since);
  if ((count ?? 0) >= 6) return "Too many calls in a few minutes. Wait a little and try again.";
  const { data: call, error } = await admin.from("voice_calls").insert({ trip_id: tripId, requested_by: requestedBy, caller_phone: callerPhone.replace(/^\+/, ""), callee_phone: callee }).select("id").single();
  if (error || !call) return "Could not start the call. Try again.";
  try {
    const sessionId = await startMaskedCall(callerPhone, call.id);
    await admin.from("voice_calls").update({ session_id: sessionId, status: "ringing" }).eq("id", call.id);
    return null;
  } catch (failure) {
    await admin.from("voice_calls").update({ status: "failed" }).eq("id", call.id);
    return failure instanceof Error ? failure.message : "Could not start the call.";
  }
}
