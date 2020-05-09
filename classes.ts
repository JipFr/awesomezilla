import { Client } from "https://deno.land/x/talk_lib/mod.ts"

/** User clients interface, store many Client classes */
export interface UserClients {
	/** The string in this case will be a Basic AUTH token */
	[string: string]: Client
}