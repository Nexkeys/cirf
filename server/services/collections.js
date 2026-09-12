import { db } from './firebaseAdmin.js'

// Every Firestore collection CIRF uses, in one place.
//
//   users/{uid}                  profile: name, email, role, estateId, unitNumber, units, status
//   invites/{email}              an admin invited this email to join their estate
//   estates/{id}                 name, address, totalHouseholds, totalUnits, joinCode
//   campaigns/{id}               one repair fund, with running totals kept on the document
//   campaigns/{id}/events/{id}   append-only audit trail for the transparency report
//   contributions/{id}           money a resident says they paid, pending until verified
//   vendorQuotes/{id}            quotes for a campaign's repair, one can be selected
//   reconciliations/{campaignId} the stored result of reconciling a campaign (1:1)
//   notifications/{id}           in-app notifications
export const collections = {
  users: db.collection('users'),
  invites: db.collection('invites'),
  estates: db.collection('estates'),
  campaigns: db.collection('campaigns'),
  contributions: db.collection('contributions'),
  vendorQuotes: db.collection('vendorQuotes'),
  reconciliations: db.collection('reconciliations'),
  notifications: db.collection('notifications'),
}
