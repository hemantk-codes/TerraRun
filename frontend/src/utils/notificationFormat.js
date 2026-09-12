// PHASE 10 — turns a raw Notification document's { type, payload } into
// copy the bell dropdown / toast can render directly. Centralized here
// (rather than duplicated between NotificationBell and
// NotificationToastStack) so a new notification type later means touching
// exactly one place.
export function formatNotification(n) {
  const p = n.payload || {}
  switch (n.type) {
    case 'territory_invaded':
      return {
        title: 'Territory invaded',
        body: `${p.invaderName || 'Someone'} ${p.fullyConsumed ? 'fully captured' : 'took part of'} your territory.`,
      }
    case 'territory_under_siege':
      return {
        title: 'Territory under siege',
        body: `${p.invaderName || 'Someone'} is repeatedly attacking your territory — reinforce it or lose ground.`,
      }
    case 'invasion_succeeded':
      return {
        title: 'Invasion successful',
        body: `You captured ${Math.round(p.areaGainedSqm || 0)} m² from ${p.defenderName || 'another runner'}.`,
      }
    case 'territory_split':
      return {
        title: 'Territory split',
        body: `${p.invaderName || 'Someone'} cut through your territory — decide what to do with the split-off piece.`,
      }
    case 'chat_message_received':
      return { title: 'New message', body: p.preview || 'You have a new message.' }
    case 'friend_request':
      return { title: 'New follower', body: `${p.fromUserName || 'Someone'} started following you.` }
    case 'leaderboard_overtaken': {
      const names = p.overtakenByNames || []
      const who =
        names.length > 1
          ? `${names[0]} and ${names.length - 1} other${names.length - 1 === 1 ? '' : 's'}`
          : names[0] || 'Someone'
      return { title: 'Leaderboard shake-up', body: `${who} passed your ${p.period || ''} Calons total.` }
    }
    case 'streak_stopper_earned':
      return {
        title: 'Streak Stopper earned',
        body: `${p.currentStreak || 30}-day streak! You earned a Streak Stopper.`,
      }
    case 'streak_stopper_offer':
      return {
        title: 'Territory decaying',
        body: 'Use a Streak Stopper to freeze decay on this territory for 3 more days?',
      }
    case 'decay_warning':
      return {
        title: 'Territory starting to decay',
        body: `No runs in a while — this territory reaches zero in about ${p.daysToZero ?? '?'} days without activity.`,
      }
    case 'territory_fully_decayed':
      return { title: 'Territory lost', body: 'A territory fully decayed and is gone.' }
    case 'call_incoming':
      return { title: 'Incoming call', body: `${p.fromUserName || 'Someone'} is calling you.` }
    default:
      return { title: n.type, body: '' }
  }
}
