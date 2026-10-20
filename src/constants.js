// Club defaults (editable in Settings by the President).
export const CLUB_DEFAULTS = {
  name: 'Vision Toastmasters Club',
  number: '991226',
  area: 'Area 02',
  division: 'Division F',
  district: 'District 126',
  venue: 'Goethe Zentrum, Road # 3, Banjara Hills, Hyderabad 500034',
  meetingDay: 'Sunday',
  startTime: '09:45',
  endTime: '12:45',
  meetupUrl: 'https://www.meetup.com/visiontm',
  rsvpName: '',
  rsvpPhone: '',
}

// Meeting roles, in agenda order. `kind` drives the "Best Role Player" awards.
export const ROLES = [
  { key: 'saa', label: 'Sergeant at Arms', kind: 'main' },
  { key: 'po', label: 'Presiding Officer', kind: 'main' },
  { key: 'tmod', label: 'Toastmaster of the Day', kind: 'main' },
  { key: 'ge', label: 'General Evaluator', kind: 'main' },
  { key: 'timer', label: 'Timer', kind: 'aux' },
  { key: 'ah', label: 'Ah Counter', kind: 'aux' },
  { key: 'grammarian', label: 'Grammarian', kind: 'aux' },
  { key: 'listener', label: 'Listener', kind: 'aux' },
  { key: 'ballot', label: 'Ballot Counter', kind: 'aux' },
  { key: 'photo', label: 'Photographer', kind: 'aux' },
  { key: 'ttm', label: 'Table Topics Master', kind: 'main' },
  { key: 'speaker', label: 'Prepared Speaker', kind: 'speech' },
  { key: 'evaluator', label: 'Speech Evaluator', kind: 'eval' },
  { key: 'ttspeaker', label: 'Table Topics Speaker', kind: 'tt' },
]
export const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.key, r.label]))
export const ROLE_KEYS = ROLES.map((r) => r.key)

// Standard agenda used when creating a meeting by hand.
export const DEFAULT_SLOTS = [
  ['saa', '10:00'], ['po', '10:03'], ['tmod', '10:10'], ['ge', '10:18'],
  ['timer', '10:18'], ['ah', '10:18'], ['grammarian', '10:18'], ['listener', '10:18'],
  ['ballot', '10:18'], ['photo', '10:18'],
  ['speaker', '10:30'], ['speaker', '10:30'], ['speaker', '10:30'], ['speaker', '10:30'],
  ['ttm', '11:25'],
]

export const MEETING_AWARDS = [
  { key: 'bestSpeaker', label: 'Best Speaker' },
  { key: 'bestEvaluator', label: 'Best Evaluator' },
  { key: 'bestRoleMain', label: 'Best Role Player (Main)' },
  { key: 'bestRoleAux', label: 'Best Auxiliary Role Player' },
  { key: 'bestListener', label: 'Best Listener' },
  { key: 'bestTableTopics', label: 'Best Table Topics Speaker' },
]
export const AWARD_LABEL = Object.fromEntries(MEETING_AWARDS.map((a) => [a.key, a.label]))

// Pathways paths. Free text is also accepted, so this list can go stale safely.
export const PATHS = [
  'Dynamic Leadership', 'Effective Coaching', 'Engaging Humor', 'Innovative Planning',
  'Leadership Development', 'Motivational Strategies', 'Persuasive Influence',
  'Presentation Mastery', 'Strategic Relationships', 'Team Collaboration',
  'Visionary Communication',
]
export const COMMON_PROJECTS = [
  'Ice Breaker', 'Evaluation and Feedback', 'Researching and Presenting',
  'Introduction to Toastmasters Mentoring', 'Understanding Your Leadership Style',
  'Understanding Your Communication Style', 'Active Listening', 'Connect with Your Audience',
  'Effective Body Language', 'Know Your Sense of Humor', 'Persuasive Speaking',
  'Using Presentation Software', 'Reflect on Your Path',
]
export const EDU_LEVELS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Path Completed', 'DTM']

export const OFFICER_TITLES = [
  'President', 'VP Education', 'VP Membership', 'VP Public Relations', 'Secretary',
  'Treasurer', 'Sergeant at Arms', 'Immediate Past President',
]

export const GUEST_SOURCES = ['Meetup', 'Friend / Member', 'Instagram', 'LinkedIn', 'Facebook', 'WhatsApp', 'Walk-in', 'Other']
export const GUEST_STATUSES = ['New', 'Follow up', 'Interested', 'Joined', 'Not interested']

// Distinguished Club Program defaults. Toastmasters may revise these, so each
// goal's label and target can be edited on the DCP page. `auto` names a metric
// the app counts for you; the rest are ticked manually.
export const DCP_GOALS = [
  { id: 1, label: 'Level 1 awards', target: 4, auto: 'L1' },
  { id: 2, label: 'Level 2 awards', target: 2, auto: 'L2' },
  { id: 3, label: 'More Level 2 awards', target: 2, auto: 'L2more' },
  { id: 4, label: 'Level 3 awards', target: 2, auto: 'L3' },
  { id: 5, label: 'Level 4, Path Completion or DTM award', target: 1, auto: 'L4plus' },
  { id: 6, label: 'One more Level 4, Path Completion or DTM award', target: 1, auto: 'L4plusMore' },
  { id: 7, label: 'New members', target: 4, auto: 'newMembers' },
  { id: 8, label: 'More new members', target: 4, auto: 'newMembersMore' },
  { id: 9, label: 'Club officers trained (both periods)', target: 4 },
  { id: 10, label: 'Renewal dues and officer list on time', target: 1 },
]
