import { db } from './firebaseAdmin.js'

// Every Firestore collection CIRF uses, in one place.
//
//   users/{uid}                  profile: name, email, phone, role, estateId, unitNumber, units, status,
//                                and requestedEstateId while waiting for an admin to approve them
//   phoneNumbers/{+234...}       which account registered a phone number (keeps numbers unique)
//   invites/{email}              an admin invited this email to join their estate
//   estates/{id}                 name, address, totalHouseholds, totalUnits, joinCode, access settings
//   campaigns/{id}               one repair fund, with running totals kept on the document
//   campaigns/{id}/events/{id}   append-only audit trail for the transparency report
//   contributions/{id}           money a resident says they paid, pending until verified
//   vendorQuotes/{id}            quotes for a campaign's repair, one can be selected
//   reconciliations/{campaignId} the stored result of reconciling a campaign (1:1)
//   notifications/{id}           in-app notifications
export const collections = {
  users: db.collection('users'),
  phoneNumbers: db.collection('phoneNumbers'),
  invites: db.collection('invites'),
  estates: db.collection('estates'),
  campaigns: db.collection('campaigns'),
  contributions: db.collection('contributions'),
  vendorQuotes: db.collection('vendorQuotes'),
  reconciliations: db.collection('reconciliations'),
  notifications: db.collection('notifications'),
}
