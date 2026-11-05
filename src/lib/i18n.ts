/**
 * The carrier app in English and Kiswahili. Each person picks a language (a cookie, so no account change is
 * needed); carriers start in English and switch from the menu. Shipper and admin screens stay in English.
 * Strings with {name} placeholders are filled by t().
 */

export type AppLang = "en" | "sw";
export const LANG_COOKIE = "vemi_lang";

const en = {
  // Menu
  "nav.home": "Home", "nav.board": "Find loads", "nav.trips": "Trips", "nav.fleet": "Fleet", "nav.earnings": "Earnings", "nav.profile": "Profile", "nav.help": "Help",
  "nav.signOut": "Sign out", "nav.role.carrier": "Carrier", "nav.switch": "Kiswahili", "nav.switchLabel": "Badilisha lugha iwe Kiswahili",
  // Carrier home
  "home.hello": "Habari, {name}", "home.verified": "Find your next load and keep your trucks moving.", "home.notVerified": "Finish setting up so we can verify you and you can start bidding.",
  "home.findLoads": "Find loads", "home.getVerified": "Get verified", "home.rejected": "Verification needs changes", "home.suspended": "Account suspended",
  "home.note": "Note from Vemi: {note}", "home.step.business": "Business details and M-Pesa payout number", "home.step.truck": "Add at least one truck",
  "home.step.driver": "Add a driver (you can add yourself)", "home.step.docs": "Upload documents: {docs}", "home.step.docsDone": "Documents uploaded",
  "home.allDone": "All done. Vemi checks documents within one working day and texts you when you're verified.", "home.checking": "Vemi checks documents within one working day of the last upload.",
  "home.activeTrips": "Active trips", "home.payoutsQueued": "Payouts on the way", "home.paid": "Paid to you so far", "home.yourTrips": "Your trips",
  "home.noTrips": "No active trips", "home.noTripsHint": "Trips you win appear here, with the next step for each.", "home.newest": "Newest loads", "home.seeAll": "See all",
  "home.install": "Install the Vemi app on this phone",
  // Find loads
  "board.title": "Find loads", "board.forMyTrucks": "Showing loads for your trucks ({types}).", "board.all": "Open loads from shippers across the region.",
  "board.notVerified": "You'll see loads once you're verified", "board.notVerifiedHint": "Add your trucks, a driver and your documents. Vemi checks them within one working day.",
  "board.whatsLeft": "See what's left to do", "board.myTypes": "My truck types", "board.fromAnywhere": "From anywhere", "board.toAnywhere": "To anywhere",
  "board.from": "From {country}", "board.to": "To {country}", "board.filter": "Filter", "board.instant": "Only loads I can book now at the shipper's price",
  "board.part": "Only part loads (fill the space left on a truck)", "board.busy": "Busy lanes this week", "board.laneLoads": "{count} loads · about KES {rate}/km",
  "board.laneLoad": "1 load · about KES {rate}/km", "board.markFree": "Mark a truck free in {fleet} to be texted first when loads come up near it.",
  "board.returns": "Return loads for your trucks", "board.yourBid": "Your bid: KES {amount} ({status})", "board.none": "No open loads match",
  "board.noneHint": "New loads come in through the day, and we email you when one fits your trucks.", "board.showAll": "Show all truck types",
  "bid.pending": "pending", "bid.accepted": "accepted", "bid.declined": "declined", "bid.withdrawn": "withdrawn",
  // One load
  "load.won": "You won this: open the trip", "load.pickupOn": "{ref} · pickup {date}", "load.pickupArea": "Pickup area", "load.stop": "Stop {n}",
  "load.pickAt": "Pick up at ", "load.dropAt": "Drop at ", "load.dropArea": "Drop-off area", "load.goods": "Goods", "load.weight": "Weight",
  "load.partNote": " · part load: fill the rest of the truck with other loads going the same way", "load.truck": "Truck", "load.distance": "Distance",
  "load.km": "about {km} km", "load.borders": ", {n} border crossings", "load.border": ", 1 border crossing", "load.notes": "Notes", "load.shipper": "Shipper",
  "load.stars": "{stars} stars from {count} carriers", "load.newShipper": "New on Vemi", "load.codes": "Codes",
  "load.codesHint": "Your driver enters a pickup code to load and the receiver's code to finish.",
  "load.contacts": "Contact names and phone numbers are shared once the shipper books you and pays. Vemi pays you to M-Pesa within 24 hours of confirmed delivery.",
  "load.offers": "Shipper offers", "load.youGet": "You get {amount} after Vemi's {percent}", "load.bookNow": "Book now at {amount}", "load.booking": "Booking…",
  "load.firstWins": "First verified truck wins. Or send a different price below.", "load.closed": "This load is no longer taking bids.", "load.withdraw": "Withdraw my bid ({amount})",
  // Bid form
  "bidform.change": "Change your bid (KES)", "bidform.price": "Your price for the trip (KES)", "bidform.receive": "You receive {amount} to M-Pesa after delivery (Vemi commission {percent}).",
  "bidform.message": "Message to the shipper (optional)", "bidform.placeholder": "e.g. Truck is in Mombasa, can load tomorrow 7am", "bidform.sending": "Sending…",
  "bidform.accept": "Accept at {amount}", "bidform.update": "Update bid", "bidform.send": "Send bid",
  // Load card
  "card.km": "about {km} km", "card.borders": "{n} borders", "card.border": "1 border", "card.bookNow": "Book now", "card.part": "Part load · {w} of {cap} t",
  "card.stops": "{n} extra stops", "card.stop": "1 extra stop", "card.cover": "Cargo cover",
  "card.next.awaiting_payment": "Assign truck and driver while the shipper pays", "card.next.scheduled": "Dispatch: send the driver to pickup",
  "card.next.completed": "Payout queued", "card.check": "Check on the truck",
  // Trip panels
  "return.title": "Load for the way back", "return.intro": "{truck} should unload in {town} around {from}. These loads pick up near there between {from} and {to}.",
  "return.yourTruck": "Your truck", "return.home": "Takes you back towards {town}", "return.none": "No loads near {town} for those days yet. We tell you by push as soon as one is posted.",
  "fill.title": "Fill your truck", "fill.none": "No part loads going the same way right now. We tell you by push when one comes up near this pickup.",
  "fill.intro": "This is a part load ({w} t). {truck}, so {space} t is still free.", "fill.carries": "{plate} carries {cap} t", "fill.about": "A {type} carries about {cap} t",
  "fill.also": " and also has {refs} on it", "fill.assign": " Assign the truck to see exactly what fits.",
  // Trip statuses
  "status.awaiting_payment": "Waiting for payment", "status.scheduled": "Paid, truck scheduled", "status.to_pickup": "Heading to pickup", "status.at_pickup": "At pickup, loading",
  "status.loaded": "Loaded", "status.in_transit": "On the road", "status.at_border": "At the border", "status.at_dropoff": "At drop-off, offloading",
  "status.delivered": "Delivered, awaiting confirmation", "status.completed": "Completed", "status.disputed": "In dispute", "status.cancelled": "Cancelled",
} as const;

export type MessageKey = keyof typeof en;

const sw: Record<MessageKey, string> = {
  "nav.home": "Nyumbani", "nav.board": "Tafuta mizigo", "nav.trips": "Safari", "nav.fleet": "Magari", "nav.earnings": "Mapato", "nav.profile": "Wasifu", "nav.help": "Msaada",
  "nav.signOut": "Toka", "nav.role.carrier": "Msafirishaji", "nav.switch": "English", "nav.switchLabel": "Switch the language to English",
  "home.hello": "Habari, {name}", "home.verified": "Pata mzigo unaofuata na magari yako yaendelee kufanya kazi.", "home.notVerified": "Maliza usajili ili tukuthibitishe na uanze kutoa bei.",
  "home.findLoads": "Tafuta mizigo", "home.getVerified": "Thibitishwa", "home.rejected": "Uthibitisho unahitaji marekebisho", "home.suspended": "Akaunti imesimamishwa",
  "home.note": "Ujumbe kutoka Vemi: {note}", "home.step.business": "Maelezo ya biashara na nambari ya M-Pesa ya malipo", "home.step.truck": "Ongeza angalau gari moja",
  "home.step.driver": "Ongeza dereva (unaweza kujiongeza mwenyewe)", "home.step.docs": "Pakia hati: {docs}", "home.step.docsDone": "Hati zimepakiwa",
  "home.allDone": "Umemaliza. Vemi hukagua hati ndani ya siku moja ya kazi na kukutumia SMS ukithibitishwa.", "home.checking": "Vemi hukagua hati ndani ya siku moja ya kazi baada ya upakiaji wa mwisho.",
  "home.activeTrips": "Safari zinazoendelea", "home.payoutsQueued": "Malipo yanayokuja", "home.paid": "Ulicholipwa hadi sasa", "home.yourTrips": "Safari zako",
  "home.noTrips": "Hakuna safari zinazoendelea", "home.noTripsHint": "Safari unazoshinda zitaonekana hapa, pamoja na hatua inayofuata ya kila moja.", "home.newest": "Mizigo mipya", "home.seeAll": "Ona yote",
  "home.install": "Weka programu ya Vemi kwenye simu hii",
  "board.title": "Tafuta mizigo", "board.forMyTrucks": "Mizigo inayofaa magari yako ({types}).", "board.all": "Mizigo iliyo wazi kutoka kwa wasafirishaji wa kanda nzima.",
  "board.notVerified": "Utaona mizigo ukishathibitishwa", "board.notVerifiedHint": "Ongeza magari yako, dereva na hati zako. Vemi huzikagua ndani ya siku moja ya kazi.",
  "board.whatsLeft": "Ona kilichobaki", "board.myTypes": "Aina za magari yangu", "board.fromAnywhere": "Kutoka popote", "board.toAnywhere": "Kwenda popote",
  "board.from": "Kutoka {country}", "board.to": "Kwenda {country}", "board.filter": "Chuja", "board.instant": "Mizigo tu ninayoweza kuchukua sasa kwa bei ya mwenye mzigo",
  "board.part": "Mizigo midogo tu (jaza nafasi iliyobaki kwenye gari)", "board.busy": "Njia zenye shughuli wiki hii", "board.laneLoads": "Mizigo {count} · takriban KES {rate}/km",
  "board.laneLoad": "Mzigo 1 · takriban KES {rate}/km", "board.markFree": "Weka gari kuwa wazi kwenye {fleet} ili upate SMS kwanza mizigo ikitokea karibu nalo.",
  "board.returns": "Mizigo ya kurudi kwa magari yako", "board.yourBid": "Bei yako: KES {amount} ({status})", "board.none": "Hakuna mzigo unaolingana",
  "board.noneHint": "Mizigo mipya huingia siku nzima, na tunakutumia barua pepe mmoja ukifaa magari yako.", "board.showAll": "Onyesha aina zote za magari",
  "bid.pending": "inasubiri", "bid.accepted": "imekubaliwa", "bid.declined": "haikuchaguliwa", "bid.withdrawn": "imeondolewa",
  "load.won": "Umeshinda: fungua safari", "load.pickupOn": "{ref} · kupakia {date}", "load.pickupArea": "Mahali pa kupakia", "load.stop": "Kituo {n}",
  "load.pickAt": "Pakia ", "load.dropAt": "Shusha ", "load.dropArea": "Mahali pa kushusha", "load.goods": "Bidhaa", "load.weight": "Uzito",
  "load.partNote": " · mzigo mdogo: jaza gari na mizigo mingine inayoelekea huko huko", "load.truck": "Gari", "load.distance": "Umbali",
  "load.km": "takriban km {km}", "load.borders": ", mipaka {n}", "load.border": ", mpaka 1", "load.notes": "Maelezo", "load.shipper": "Mwenye mzigo",
  "load.stars": "Nyota {stars} kutoka kwa wasafirishaji {count}", "load.newShipper": "Mgeni kwenye Vemi", "load.codes": "Namba za siri",
  "load.codesHint": "Dereva wako huweka namba ya kupakia, na namba ya mpokeaji ili kumaliza.",
  "load.contacts": "Majina na nambari za simu hutolewa mwenye mzigo akishakuchagua na kulipa. Vemi hukulipa kwa M-Pesa ndani ya saa 24 baada ya mzigo kuthibitishwa kufika.",
  "load.offers": "Mwenye mzigo anatoa", "load.youGet": "Unapata {amount} baada ya {percent} ya Vemi", "load.bookNow": "Chukua sasa kwa {amount}", "load.booking": "Inachukua…",
  "load.firstWins": "Gari la kwanza lililothibitishwa linashinda. Au tuma bei tofauti hapa chini.", "load.closed": "Mzigo huu haupokei bei tena.", "load.withdraw": "Ondoa bei yangu ({amount})",
  "bidform.change": "Badilisha bei yako (KES)", "bidform.price": "Bei yako ya safari (KES)", "bidform.receive": "Unapokea {amount} kwa M-Pesa baada ya kufikisha mzigo (kamisheni ya Vemi {percent}).",
  "bidform.message": "Ujumbe kwa mwenye mzigo (si lazima)", "bidform.placeholder": "mf. Gari liko Mombasa, linaweza kupakia kesho saa moja asubuhi", "bidform.sending": "Inatuma…",
  "bidform.accept": "Kubali kwa {amount}", "bidform.update": "Badilisha bei", "bidform.send": "Tuma bei",
  "card.km": "takriban km {km}", "card.borders": "mipaka {n}", "card.border": "mpaka 1", "card.bookNow": "Chukua sasa", "card.part": "Mzigo mdogo · t {w} kati ya {cap}",
  "card.stops": "vituo {n} vya ziada", "card.stop": "kituo 1 cha ziada", "card.cover": "Bima ya mzigo",
  "card.next.awaiting_payment": "Chagua gari na dereva mwenye mzigo akilipa", "card.next.scheduled": "Tuma dereva aende kupakia",
  "card.next.completed": "Malipo yako yamepangwa", "card.check": "Angalia gari",
  "return.title": "Mzigo wa kurudi", "return.intro": "{truck} linatarajiwa kushusha {town} karibu {from}. Mizigo hii inapakiwa karibu na hapo kati ya {from} na {to}.",
  "return.yourTruck": "Gari lako", "return.home": "Inakurudisha kuelekea {town}", "return.none": "Bado hakuna mizigo karibu na {town} kwa siku hizo. Tutakuarifu mara mmoja ukiwekwa.",
  "fill.title": "Jaza gari lako", "fill.none": "Kwa sasa hakuna mizigo midogo inayoelekea huko huko. Tutakuarifu mmoja ukitokea karibu na mahali hapa pa kupakia.",
  "fill.intro": "Huu ni mzigo mdogo (t {w}). {truck}, kwa hiyo t {space} bado ziko wazi.", "fill.carries": "{plate} hubeba t {cap}", "fill.about": "{type} hubeba takriban t {cap}",
  "fill.also": " na pia lina {refs}", "fill.assign": " Chagua gari ili uone hasa kinachotosha.",
  "status.awaiting_payment": "Inasubiri malipo", "status.scheduled": "Imelipwa, gari limepangwa", "status.to_pickup": "Linaelekea kupakia", "status.at_pickup": "Liko kupakia",
  "status.loaded": "Limepakiwa", "status.in_transit": "Liko barabarani", "status.at_border": "Liko mpakani", "status.at_dropoff": "Liko kushusha",
  "status.delivered": "Limefika, linasubiri uthibitisho", "status.completed": "Imekamilika", "status.disputed": "Kuna mzozo", "status.cancelled": "Imeghairiwa",
};

const DICTIONARIES: Record<AppLang, Record<MessageKey, string>> = { en, sw };

export function asLang(value: string | null | undefined): AppLang {
  return value === "sw" ? "sw" : "en";
}

/** The text for a key in this language, with {placeholders} filled in. */
export function t(lang: AppLang, key: MessageKey, vars: Record<string, string | number> = {}) {
  const text = DICTIONARIES[lang][key] ?? en[key];
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** A t() bound to one language, handy in components. */
export function translator(lang: AppLang) {
  return (key: MessageKey, vars?: Record<string, string | number>) => t(lang, key, vars);
}

export function tripStatusLabel(lang: AppLang, status: string) {
  const key = `status.${status}` as MessageKey;
  return key in en ? t(lang, key) : status;
}

/** Dates in the person's language ("12 Nov 2026" / "12 Nov 2026" in sw-KE style). */
export function formatDateIn(lang: AppLang, value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang === "sw" ? "sw-KE" : "en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(value));
}
