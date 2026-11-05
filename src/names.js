// Name and email clean-up shared by the data layer and the roster import.
export const normEmail = (e) => (e || '').trim().toLowerCase()
const TITLE_RE = /^(tm|dtm|ptm|ctm|acs|acb|acg|als|alb|cl|mr|mrs|ms|dr)\.?\s+/i
export const cleanName = (n) => (n || '').replace(TITLE_RE, '').replace(TITLE_RE, '').replace(/\s+/g, ' ').trim()
