import { Client } from "https://raw.githubusercontent.com/JipFr/talk-lib/master/mod.ts"

/** User clients interface, store many Client classes */
export interface UserClients {
	/** The string in this case will be a Basic AUTH token */
	[string: string]: Client
}