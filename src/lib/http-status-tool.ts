import type { MessageKey } from "../i18n/en-GB";

export interface HttpStatus {
  code: number;
  /** The reason phrase from the IANA registry. It is part of the protocol, so it isn’t translated. */
  name: string;
  /** One line on what the code means. */
  meaning: MessageKey;
  /** When to send it. */
  use: MessageKey;
}

/** The five classes, by first digit. */
export const statusClasses = [1, 2, 3, 4, 5] as const;
export type StatusClass = (typeof statusClasses)[number];

const status = (code: number, name: string, meaning: MessageKey, use: MessageKey): HttpStatus => ({
  code,
  name,
  meaning,
  use,
});

/**
 * Every code in the IANA HTTP status code registry (RFC 9110 and its extensions), including the
 * deprecated 305 and 510 and the reserved 418, which people still look up.
 */
export const httpStatuses: readonly HttpStatus[] = [
  status(100, "Continue", "tools.http.meaning.100", "tools.http.use.100"),
  status(101, "Switching Protocols", "tools.http.meaning.101", "tools.http.use.101"),
  status(102, "Processing", "tools.http.meaning.102", "tools.http.use.102"),
  status(103, "Early Hints", "tools.http.meaning.103", "tools.http.use.103"),
  status(200, "OK", "tools.http.meaning.200", "tools.http.use.200"),
  status(201, "Created", "tools.http.meaning.201", "tools.http.use.201"),
  status(202, "Accepted", "tools.http.meaning.202", "tools.http.use.202"),
  status(203, "Non-Authoritative Information", "tools.http.meaning.203", "tools.http.use.203"),
  status(204, "No Content", "tools.http.meaning.204", "tools.http.use.204"),
  status(205, "Reset Content", "tools.http.meaning.205", "tools.http.use.205"),
  status(206, "Partial Content", "tools.http.meaning.206", "tools.http.use.206"),
  status(207, "Multi-Status", "tools.http.meaning.207", "tools.http.use.207"),
  status(208, "Already Reported", "tools.http.meaning.208", "tools.http.use.208"),
  status(226, "IM Used", "tools.http.meaning.226", "tools.http.use.226"),
  status(300, "Multiple Choices", "tools.http.meaning.300", "tools.http.use.300"),
  status(301, "Moved Permanently", "tools.http.meaning.301", "tools.http.use.301"),
  status(302, "Found", "tools.http.meaning.302", "tools.http.use.302"),
  status(303, "See Other", "tools.http.meaning.303", "tools.http.use.303"),
  status(304, "Not Modified", "tools.http.meaning.304", "tools.http.use.304"),
  status(305, "Use Proxy", "tools.http.meaning.305", "tools.http.use.305"),
  status(307, "Temporary Redirect", "tools.http.meaning.307", "tools.http.use.307"),
  status(308, "Permanent Redirect", "tools.http.meaning.308", "tools.http.use.308"),
  status(400, "Bad Request", "tools.http.meaning.400", "tools.http.use.400"),
  status(401, "Unauthorized", "tools.http.meaning.401", "tools.http.use.401"),
  status(402, "Payment Required", "tools.http.meaning.402", "tools.http.use.402"),
  status(403, "Forbidden", "tools.http.meaning.403", "tools.http.use.403"),
  status(404, "Not Found", "tools.http.meaning.404", "tools.http.use.404"),
  status(405, "Method Not Allowed", "tools.http.meaning.405", "tools.http.use.405"),
  status(406, "Not Acceptable", "tools.http.meaning.406", "tools.http.use.406"),
  status(407, "Proxy Authentication Required", "tools.http.meaning.407", "tools.http.use.407"),
  status(408, "Request Timeout", "tools.http.meaning.408", "tools.http.use.408"),
  status(409, "Conflict", "tools.http.meaning.409", "tools.http.use.409"),
  status(410, "Gone", "tools.http.meaning.410", "tools.http.use.410"),
  status(411, "Length Required", "tools.http.meaning.411", "tools.http.use.411"),
  status(412, "Precondition Failed", "tools.http.meaning.412", "tools.http.use.412"),
  status(413, "Content Too Large", "tools.http.meaning.413", "tools.http.use.413"),
  status(414, "URI Too Long", "tools.http.meaning.414", "tools.http.use.414"),
  status(415, "Unsupported Media Type", "tools.http.meaning.415", "tools.http.use.415"),
  status(416, "Range Not Satisfiable", "tools.http.meaning.416", "tools.http.use.416"),
  status(417, "Expectation Failed", "tools.http.meaning.417", "tools.http.use.417"),
  status(418, "I’m a teapot", "tools.http.meaning.418", "tools.http.use.418"),
  status(421, "Misdirected Request", "tools.http.meaning.421", "tools.http.use.421"),
  status(422, "Unprocessable Content", "tools.http.meaning.422", "tools.http.use.422"),
  status(423, "Locked", "tools.http.meaning.423", "tools.http.use.423"),
  status(424, "Failed Dependency", "tools.http.meaning.424", "tools.http.use.424"),
  status(425, "Too Early", "tools.http.meaning.425", "tools.http.use.425"),
  status(426, "Upgrade Required", "tools.http.meaning.426", "tools.http.use.426"),
  status(428, "Precondition Required", "tools.http.meaning.428", "tools.http.use.428"),
  status(429, "Too Many Requests", "tools.http.meaning.429", "tools.http.use.429"),
  status(431, "Request Header Fields Too Large", "tools.http.meaning.431", "tools.http.use.431"),
  status(451, "Unavailable For Legal Reasons", "tools.http.meaning.451", "tools.http.use.451"),
  status(500, "Internal Server Error", "tools.http.meaning.500", "tools.http.use.500"),
  status(501, "Not Implemented", "tools.http.meaning.501", "tools.http.use.501"),
  status(502, "Bad Gateway", "tools.http.meaning.502", "tools.http.use.502"),
  status(503, "Service Unavailable", "tools.http.meaning.503", "tools.http.use.503"),
  status(504, "Gateway Timeout", "tools.http.meaning.504", "tools.http.use.504"),
  status(505, "HTTP Version Not Supported", "tools.http.meaning.505", "tools.http.use.505"),
  status(506, "Variant Also Negotiates", "tools.http.meaning.506", "tools.http.use.506"),
  status(507, "Insufficient Storage", "tools.http.meaning.507", "tools.http.use.507"),
  status(508, "Loop Detected", "tools.http.meaning.508", "tools.http.use.508"),
  status(510, "Not Extended", "tools.http.meaning.510", "tools.http.use.510"),
  status(511, "Network Authentication Required", "tools.http.meaning.511", "tools.http.use.511"),
];

export const statusClass = (code: number) => Math.floor(code / 100) as StatusClass;

/** The search terms a query is split into: lower case, with apostrophes made straight. */
const terms = (text: string) => text.toLowerCase().replaceAll("’", "'").split(/\s+/u).filter(Boolean);

/**
 * Whether a status matches a search. Every term must match: a number matches codes that start
 * with it (so `40` finds 400 to 409), `4xx` matches a whole class, and a word matches the code’s
 * name or description anywhere.
 */
export const matchesStatus = (query: string, code: number, text: string) => {
  const haystack = `${code} ${text}`.toLowerCase().replaceAll("’", "'");
  return terms(query).every((term) => {
    if (/^\d{1,3}$/u.test(term)) return String(code).startsWith(term);
    const group = /^([1-5])xx$/u.exec(term)?.[1];
    if (group !== undefined) return statusClass(code) === Number(group);
    return haystack.includes(term);
  });
};
