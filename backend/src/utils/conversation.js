/**
 * Conversations are created lazily (see Message.js's schema comment) — no
 * separate Conversation collection, just a stable string key derived from
 * the two participants' ids, sorted so it's identical no matter who
 * initiated. Pulled out into its own module (rather than inlined at every
 * call site) so the REST message-history controller and the Socket.io chat
 * handlers can't drift out of sync on the derivation scheme.
 */
export function getConversationId(userIdA, userIdB) {
  return [userIdA.toString(), userIdB.toString()].sort().join('_');
}

/** Inverse of getConversationId — returns the two participant id strings. */
export function getParticipantIds(conversationId) {
  return conversationId.split('_');
}
