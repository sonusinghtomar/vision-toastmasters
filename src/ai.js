import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { app } from './firebase'
import { GEMINI_MODEL } from './config'
import { ROLES, ROLE_KEYS, MEETING_AWARDS } from './constants'

let ai
function model(responseSchema) {
  ai ||= getAI(app, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.1 },
  })
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
    number: Schema.integer({ description: 'Meeting number, e.g. 484' }),
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
        optionalProperties: ['person', 'time', 'duration', 'title', 'project', 'path', 'level', 'evaluator'],
      }),
    }),
    officers: Schema.array({
      items: Schema.object({ properties: { title: Schema.string(), name: Schema.string() } }),
    }),
  },
  optionalProperties: ['number', 'theme', 'date', 'startTime', 'endTime', 'venue', 'officers'],
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
- Officers are the club officer list (President, VP Education, etc.) if printed.`
  const res = await model(agendaSchema).generateContent([prompt, { inlineData: { data, mimeType: file.type || 'application/pdf' } }])
  return JSON.parse(res.response.text())
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
          role: Schema.enumString({ enum: ROLE_KEYS }),
          award: Schema.enumString({ enum: MEETING_AWARDS.map((a) => a.key) }),
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
        optionalProperties: ['person', 'personType', 'role', 'award', 'title', 'path', 'level', 'project',
          'actualTime', 'evaluator', 'phone', 'email', 'source', 'text'],
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
- role: person took a meeting role. Role keys: ${roleList}.
- award: meeting award won. Award keys: ${MEETING_AWARDS.map((a) => `${a.key} = ${a.label}`).join('; ')}.
- guest: a new guest's details (person, phone, email, source, text).
- evaluation: evaluation feedback about a speaker (person = speaker, evaluator, text).
- note: anything else.
Use names exactly as in the known lists when they clearly match.
Known members: ${context.members.join(', ') || 'none'}.
Known guests: ${context.guests.join(', ') || 'none'}.
${context.meeting ? `Current meeting: #${context.meeting.number || ''} on ${context.meeting.date}.` : ''}
${context.self ? `The speaker of this note is ${context.self}; "I" or "my" means ${context.self}.` : ''}`
  const parts = [prompt]
  if (audio) parts.push({ inlineData: { data: await fileToBase64(audio), mimeType: audio.type.split(';')[0] || 'audio/webm' } })
  if (text) parts.push(`Note: ${text}`)
  const res = await model(actionSchema).generateContent(parts)
  return JSON.parse(res.response.text())
}
