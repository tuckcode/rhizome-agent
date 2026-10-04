export type PersonalInfoFinding = {
  file: string
  line: number
  kind: 'home path' | 'personal email'
  text: string
}

export type PersonalInfoOptions = {
  /** Usernames that are real people, e.g. this machine's account name. */
  names: string[]
}

export function findPersonalInfo(diff: string, options: PersonalInfoOptions): PersonalInfoFinding[]
