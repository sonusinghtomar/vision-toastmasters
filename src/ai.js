import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { app } from './firebase'
import { GEMINI_MODEL, GEMINI_FALLBACK_MODEL } from './config'
import { ROLES, ROLE_KEYS, MEETING_AWARDS } from './constants'

let ai
function model(responseSchema, name = GEMINI_MODEL) {
  ai ||= getAI(app, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: name,
    generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.1 },
  })
}

// The free tier allows a few requests per minute and Google is sometimes busy.
// Alternate between the main and fallback models, waiting a little longer each round,
// before giving up with a clear message.
async function generate(schema, parts) {
  const waits = [0, 3000, 10000, 25000]
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await model(schema, attempt % 2 ? GEMINI_FALLBACK_MODEL : GEMINI_MODEL).generateContent(parts)
      return JSON.parse(res.response.text())
    } catch (e) {
      const msg = String(e?.message || e)
      const busy = /high demand|overloaded|unavailable|503/i.test(msg)
      const quota = /quota|rate.?limit|429|resource.?exhausted/i.test(msg)
      if ((busy || quota) && attempt + 1 < waits.length) {
        await new Promise((r) => setTimeout(r, waits[attempt + 1]))
        continue
      }
      if (quota) throw new Error('Gemini free limit reached (a few requests per minute). Please wait a minute and try again.')
      if (busy) throw new Error('Gemini is busy right now. Please try again in a few minutes.')
      throw e
    }
  }
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

const roleList = ROLES.map((r) => `${r.key} = ${r.label}`).join('; ')

// ── Agenda (PDF or photo) → meeting ────────────────────────
const agendaSchema = Schema.object({
  properties: {
    number: Schema.integer({ description: 'Meeting number, e.g. 484. 0 if not printed.' }),
    theme: Schema.string(),
    date: Schema.string({ description: 'Meeting date as YYYY-MM-DD' }),
    startTime: Schema.string({ description: 'HH:MM 24h' }),
    endTime: Schema.string({ description: 'HH:MM 24h' }),
    venue: Schema.string(),
    slots: Schema.array({
      items: Schema.object({
        properties: {
          role: Schema.enumString({ enum: ROLE_KEYS }),
          person: Schema.string({ description: 'Name as printed, without TM/DTM prefix. Empty if "To Be Assigned".' }),
          time: Schema.string({ description: 'Start time of the section, HH:MM 24h' }),
          duration: Schema.string({ description: 'Speech time window e.g. "5-7"' }),
          title: Schema.string({ description: 'Speech title if printed' }),
          project: Schema.string({ description: 'Pathways project if printed' }),
          path: Schema.string({ description: 'Pathways path if printed' }),
          level: Schema.string({ description: 'Pathways level if printed, e.g. "Level 2"' }),
          evaluator: Schema.string({ description: 'For prepared speakers: the evaluator name' }),
        },
      }),
    }),
    officers: Schema.array({
      items: Schema.object({ properties: { title: Schema.string(), name: Schema.string() } }),
    }),
  },
})

export async function parseAgenda(file) {
  const data = await fileToBase64(file)
  const prompt = `You read Toastmasters club meeting agendas. Extract the meeting details and every role assignment.
Role keys: ${roleList}.
Rules:
- One slot per person per role. Prepared speakers become role "speaker" with their evaluator in "evaluator" (do not add a separate evaluator slot).
- "TMOD" or "Toastmaster" = tmod. "GE" = ge. "Table Topic" master = ttm. "SAA" = saa. "Presiding Officer"/"PO" = po.
- Grammarian with WOD/IOD = grammarian. Ballot counter = ballot. Photographer = photo.
- If a role says "To Be Assigned", keep the slot with an empty person.
- Strip prefixes like TM, DTM from names. Use the time printed for each section.
- Officers are the club officer list (President, VP Education, etc.) if printed.
- Fill every field. Use an empty string for anything not printed (and 0 for a missing meeting number).`
  return generate(agendaSchema, [prompt, { inlineData: { data, mimeType: file.type || 'application/pdf' } }])
}

// ── Voice note or typed note → actions ─────────────────────
const actionSchema = Schema.object({
  properties: {
    actions: Schema.array({
      items: Schema.object({
        properties: {
          type: Schema.enumString({ enum: ['attendance', 'speech', 'role', 'award', 'guest', 'evaluation', 'note'] }),
          person: Schema.string({ description: 'Person the action is about' }),
          personType: Schema.enumString({ enum: ['member', 'guest'] }),
          role: Schema.enumString({ enum: [...ROLE_KEYS, 'none'] }),
          award: Schema.enumString({ enum: [...MEETING_AWARDS.map((a) => a.key), 'none'] }),
          title: Schema.string(),
          path: Schema.string(),
          level: Schema.string(),
          project: Schema.string(),
          actualTime: Schema.string({ description: 'Speech time like 6:30' }),
          evaluator: Schema.string(),
          phone: Schema.string(),
          email: Schema.string(),
          source: Schema.string({ description: 'How a guest heard about the club' }),
          text: Schema.string({ description: 'Notes, evaluation comments or free text' }),
        },
      }),
    }),
    transcript: Schema.string({ description: 'What was said, cleaned up' }),
  },
})

export async function parseNote({ audio, text, context }) {
  const prompt = `You help officers of a Toastmasters club log meeting data by voice. Turn the note into actions.
Action types:
- attendance: person was present (personType member or guest).
- speech: a prepared speech (person = speaker; include title, path, level, project, actualTime, evaluator when said).
  Pathways project names such as Ice Breaker, Evaluation and Feedback or Researching and Presenting go in project; the speech's own name goes in title.
- role: person took a meeting role. Role keys: ${roleList}.
- award: meeting award won. Award keys: ${MEETING_AWARDS.map((a) => `${a.key} = ${a.label}`).join('; ')}.
- guest: a new guest's details (person, phone, email, source, text).
- evaluation: evaluation feedback about a speaker (person = speaker, evaluator, text).
- note: anything else.
Fill every field of every action: put each detail that was said (title, project, level, time, evaluator, phone, email, comments) in its field, use an empty string for details not mentioned, and "none" for role/award when they do not apply.
Do not add an empty note action.
Use names exactly as in the known lists when they clearly match.
Known members: ${context.members.join(', ') || 'none'}.
Known guests: ${context.guests.join(', ') || 'none'}.
${context.meeting ? `Current meeting: #${context.meeting.number || ''} on ${context.meeting.date}.` : ''}
${context.self ? `The speaker of this note is ${context.self}; "I" or "my" means ${context.self}.` : ''}`
  const parts = [prompt]
  if (audio) parts.push({ inlineData: { data: await fileToBase64(audio), mimeType: audio.type.split(';')[0] || 'audio/webm' } })
  if (text) parts.push(`Note: ${text}`)
  const r = await generate(actionSchema, parts)
  const actions = (r.actions || [])
    .map((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== '' && v !== 'none' && v != null)))
    .filter((a) => a.type !== 'note' || a.text)
  return { ...r, actions }
}
