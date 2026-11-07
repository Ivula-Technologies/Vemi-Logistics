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
  // Earnings
  "earn.title": "Earnings", "earn.csv": "Download statement (CSV)", "earn.intro": "Payouts go to your M-Pesa within 24 hours of the shipper confirming delivery. Tips go 100% to you, and fuel advances are taken off the trip payout.",
  "earn.onTheWay": "On the way", "earn.paid": "Paid", "earn.held": "Held (dispute)", "earn.heldShort": "Held", "earn.paidOn": "Paid {date}",
  "earn.kind.trip": "Trip payout", "earn.kind.advance": "Fuel advance", "earn.kind.tip": "Tip from the shipper", "earn.kind.cancellation": "Cancellation fee", "earn.kind.bonus": "Bonus",
  "earn.line": "Trip {price} − commission {commission}", "earn.to": " · to {phone}", "earn.ref": " · ref {ref}", "earn.none": "No payouts yet", "earn.noneHint": "Finish a trip and your first payout shows here.",
  // Fleet
  "fleet.title": "Fleet", "fleet.intro": "Your trucks decide which loads you see. Mark a truck free to get loads near it. Drivers get a trip link by SMS or WhatsApp; they don't need an account.",
  "fleet.needBusiness": "Save your business details first", "fleet.goProfile": "Go to profile", "fleet.trucks": "Trucks", "fleet.drivers": "Drivers",
  "fleet.freeAt": "Free at {place} from {date}", "fleet.heading": ", heading to {place}", "fleet.markBusy": "Mark busy", "fleet.licence": " · licence {no}", "fleet.uploaded": "{docs} uploaded",
  "fleet.language": "Language", "fleet.save": "Save", "fleet.addDoc": "Add the driver's licence or good-conduct certificate", "fleet.upload": "Upload",
  "fleet.free": "Truck is free: find me loads", "fleet.where": "Where is it?", "fleet.freeFrom": "Free from", "fleet.headingTo": "Heading to (optional)", "fleet.headingHint": "Going home? We'll show loads on the way.",
  "fleet.note": "Note (optional)", "fleet.notePlaceholder": "Can do 2 trips this week", "fleet.markFree": "Mark free for 3 days",
  "fleet.replacePhoto": "Replace photo", "fleet.truckPhoto": "Add truck photo", "fleet.driverPhoto": "Add driver photo", "fleet.active": "Active", "fleet.off": "Off", "fleet.turnOff": "Turn off", "fleet.turnOn": "Turn on",
  "fleet.saved.online": "Truck marked free. We'll text you loads near it, and return loads show first on Find loads.", "fleet.saved.offline": "Truck marked busy.",
  "fleet.saved.photo": "Photo saved. Shippers see it once a trip is paid.", "fleet.saved.language": "Language saved.",
  // Carrier trip actions
  "ta.truckDriver": "Truck and driver", "ta.assignTitle": "Assign a truck and driver", "ta.waitPay": "Waiting for the shipper to pay. Get ready now; you'll get an SMS the moment it's paid.",
  "ta.truck": "Truck", "ta.driver": "Driver", "ta.choose": "Choose", "ta.smsDriver": "Text the driver their trip link (in their language)", "ta.saving": "Saving…", "ta.change": "Change", "ta.assign": "Assign",
  "ta.needFleet": "Add a truck and a driver in {fleet} first.", "ta.driverLink": "Driver's trip link",
  "ta.driverLinkHint": "The driver opens it on their phone to see pickup details, enter the codes and tap each step. Location is shared only while it's open.",
  "ta.update": "Update the trip", "ta.updateHint": "Your driver can do this from their link. Each update tells the shipper.",
  "ta.codesHint": " Loading needs the pickup code; delivering needs the receiver's code or a delivery photo.", "ta.stop": "Stop {n}: ", "ta.pickAt": "pick up at", "ta.dropAt": "drop at", "ta.done": "Done",
  "ta.extras": "Photos, extras and fuel", "ta.pod": "Delivery photo", "ta.uploading": "Uploading…", "ta.upload": "Upload", "ta.podHint": "A photo of the signed delivery note speeds up confirmation and your payout.",
  "ta.advance": "Fuel advance", "ta.advanceHint": "Take up to {max} of your payout now for a {fee} fee. The rest comes after delivery.", "ta.request": "Request",
  "ta.advanceSent": "Fuel advance: {amount} sent or on its way (fee {fee}).", "ta.extraCharge": "Ask for an extra charge",
  "ta.waitingHint": "Waiting time over {hours} hours is added automatically when the driver taps Arrived and then Loaded or Delivered.",
  "ta.cantDo": "I can't do this trip", "ta.cancelHint": "The load goes back on the board and the shipper gets their money back.",
  "ta.cancelScore": " Cancelling after payment counts against your reliability score, which shippers see with every bid.", "ta.why": "Tell the shipper why", "ta.giveBack": "Give the trip back",
  // Carrier forms
  "form.pickupCode": "Pickup code", "form.deliveryCode": "Delivery code", "form.deliveryCodeOrPhoto": "Delivery code (or photo)",
  "form.chargeFor": "For", "form.chargeLoading": "Loading or offloading help", "form.chargeStop": "An extra stop", "form.chargeOther": "Something else",
  "form.amount": "Amount (KES)", "form.why": "Why", "form.whyPlaceholder": "e.g. 2 casual loaders at Kampala", "form.sending": "Sending…", "form.askShipper": "Ask the shipper",
  "form.plate": "Number plate", "form.type": "Type", "form.capacity": "Capacity (tonnes)", "form.makeModel": "Make and model (optional)", "form.makeModelPlaceholder": "e.g. Mercedes Actros 2014",
  "form.adding": "Adding…", "form.addTruck": "Add truck", "form.driverName": "Driver's name", "form.mobile": "Mobile number", "form.licence": "Licence number (optional)",
  "form.driverLang": "Driver's language", "form.driverLangHint": "Their trip page and texts use it.", "form.addDriver": "Add driver",
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
  "earn.title": "Mapato", "earn.csv": "Pakua taarifa (CSV)", "earn.intro": "Malipo huingia kwenye M-Pesa yako ndani ya saa 24 baada ya mwenye mzigo kuthibitisha umefika. Bakshishi ni yako yote, na pesa ya mafuta ya mapema hukatwa kwenye malipo ya safari.",
  "earn.onTheWay": "Yanakuja", "earn.paid": "Yamelipwa", "earn.held": "Yamezuiliwa (mzozo)", "earn.heldShort": "Yamezuiliwa", "earn.paidOn": "Imelipwa {date}",
  "earn.kind.trip": "Malipo ya safari", "earn.kind.advance": "Pesa ya mafuta ya mapema", "earn.kind.tip": "Bakshishi kutoka kwa mwenye mzigo", "earn.kind.cancellation": "Ada ya kughairi", "earn.kind.bonus": "Bonasi",
  "earn.line": "Safari {price} − kamisheni {commission}", "earn.to": " · kwa {phone}", "earn.ref": " · kumb. {ref}", "earn.none": "Bado hakuna malipo", "earn.noneHint": "Maliza safari na malipo yako ya kwanza yataonekana hapa.",
  "fleet.title": "Magari", "fleet.intro": "Magari yako huamua mizigo unayoona. Weka gari kuwa wazi ili upate mizigo karibu nalo. Madereva hupata kiungo cha safari kwa SMS au WhatsApp; hawahitaji akaunti.",
  "fleet.needBusiness": "Hifadhi maelezo ya biashara yako kwanza", "fleet.goProfile": "Nenda kwenye wasifu", "fleet.trucks": "Magari", "fleet.drivers": "Madereva",
  "fleet.freeAt": "Liko wazi {place} kuanzia {date}", "fleet.heading": ", linaelekea {place}", "fleet.markBusy": "Weka lina kazi", "fleet.licence": " · leseni {no}", "fleet.uploaded": "{docs} zimepakiwa",
  "fleet.language": "Lugha", "fleet.save": "Hifadhi", "fleet.addDoc": "Ongeza leseni ya dereva au cheti cha tabia njema", "fleet.upload": "Pakia",
  "fleet.free": "Gari liko wazi: nitafutie mizigo", "fleet.where": "Liko wapi?", "fleet.freeFrom": "Wazi kuanzia", "fleet.headingTo": "Linaelekea (si lazima)", "fleet.headingHint": "Unarudi nyumbani? Tutakuonyesha mizigo ya njiani.",
  "fleet.note": "Maelezo (si lazima)", "fleet.notePlaceholder": "Naweza safari 2 wiki hii", "fleet.markFree": "Weka wazi kwa siku 3",
  "fleet.replacePhoto": "Badilisha picha", "fleet.truckPhoto": "Ongeza picha ya gari", "fleet.driverPhoto": "Ongeza picha ya dereva", "fleet.active": "Linafanya kazi", "fleet.off": "Limezimwa", "fleet.turnOff": "Zima", "fleet.turnOn": "Washa",
  "fleet.saved.online": "Gari limewekwa wazi. Tutakutumia SMS za mizigo karibu nalo, na mizigo ya kurudi itaonekana kwanza kwenye Tafuta mizigo.", "fleet.saved.offline": "Gari limewekwa lina kazi.",
  "fleet.saved.photo": "Picha imehifadhiwa. Wenye mizigo wataiona safari ikishalipwa.", "fleet.saved.language": "Lugha imehifadhiwa.",
  "ta.truckDriver": "Gari na dereva", "ta.assignTitle": "Chagua gari na dereva", "ta.waitPay": "Inasubiri mwenye mzigo alipe. Jiandae sasa; utapata SMS mara tu malipo yakiingia.",
  "ta.truck": "Gari", "ta.driver": "Dereva", "ta.choose": "Chagua", "ta.smsDriver": "Mtumie dereva kiungo cha safari kwa SMS (kwa lugha yake)", "ta.saving": "Inahifadhi…", "ta.change": "Badilisha", "ta.assign": "Weka",
  "ta.needFleet": "Ongeza gari na dereva kwenye {fleet} kwanza.", "ta.driverLink": "Kiungo cha safari cha dereva",
  "ta.driverLinkHint": "Dereva hukifungua kwenye simu yake kuona maelezo ya kupakia, kuweka namba za siri na kubonyeza kila hatua. Mahali alipo huonekana tu kikiwa wazi.",
  "ta.update": "Sasisha safari", "ta.updateHint": "Dereva wako anaweza kufanya hivi kwenye kiungo chake. Kila sasisho humjulisha mwenye mzigo.",
  "ta.codesHint": " Kupakia kunahitaji namba ya kupakia; kushusha kunahitaji namba ya mpokeaji au picha ya kufikisha.", "ta.stop": "Kituo {n}: ", "ta.pickAt": "pakia", "ta.dropAt": "shusha", "ta.done": "Imekamilika",
  "ta.extras": "Picha, gharama za ziada na mafuta", "ta.pod": "Picha ya kufikisha", "ta.uploading": "Inapakia…", "ta.upload": "Pakia", "ta.podHint": "Picha ya hati ya kufikisha iliyosainiwa huharakisha uthibitisho na malipo yako.",
  "ta.advance": "Pesa ya mafuta ya mapema", "ta.advanceHint": "Chukua hadi {max} ya malipo yako sasa kwa ada ya {fee}. Kilichobaki huja baada ya kufikisha.", "ta.request": "Omba",
  "ta.advanceSent": "Pesa ya mafuta: {amount} imetumwa au iko njiani (ada {fee}).", "ta.extraCharge": "Omba gharama ya ziada",
  "ta.waitingHint": "Muda wa kusubiri zaidi ya saa {hours} huongezwa wenyewe dereva akibonyeza Amefika kisha Limepakiwa au Limefika.",
  "ta.cantDo": "Siwezi kufanya safari hii", "ta.cancelHint": "Mzigo unarudi sokoni na mwenye mzigo anarudishiwa pesa yake.",
  "ta.cancelScore": " Kughairi baada ya malipo kunashusha alama yako ya kuaminika, ambayo wenye mizigo huiona kwa kila bei.", "ta.why": "Mweleze mwenye mzigo sababu", "ta.giveBack": "Rudisha safari",
  "form.pickupCode": "Namba ya kupakia", "form.deliveryCode": "Namba ya kufikisha", "form.deliveryCodeOrPhoto": "Namba ya kufikisha (au picha)",
  "form.chargeFor": "Kwa ajili ya", "form.chargeLoading": "Msaada wa kupakia au kushusha", "form.chargeStop": "Kituo cha ziada", "form.chargeOther": "Kitu kingine",
  "form.amount": "Kiasi (KES)", "form.why": "Sababu", "form.whyPlaceholder": "mf. vibarua 2 wa kupakia Kampala", "form.sending": "Inatuma…", "form.askShipper": "Muombe mwenye mzigo",
  "form.plate": "Namba ya gari", "form.type": "Aina", "form.capacity": "Uwezo (tani)", "form.makeModel": "Aina na modeli (si lazima)", "form.makeModelPlaceholder": "mf. Mercedes Actros 2014",
  "form.adding": "Inaongeza…", "form.addTruck": "Ongeza gari", "form.driverName": "Jina la dereva", "form.mobile": "Nambari ya simu", "form.licence": "Namba ya leseni (si lazima)",
  "form.driverLang": "Lugha ya dereva", "form.driverLangHint": "Ukurasa wake wa safari na SMS zitatumia lugha hii.", "form.addDriver": "Ongeza dereva",
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
