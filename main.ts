import { Application, Context } from "https://deno.land/x/abc@v1.0.0-rc5/mod.ts";
import { renderFile } from "https://deno.land/x/dejs/mod.ts";
import { Client, Message, Channel } from "https://deno.land/x/talk_lib/mod.ts"
import { Parser, HtmlRenderer } from "https://cdn.pika.dev/commonmark@0.29.1"
import { UserClients } from "./classes.ts";
import { getEmbed } from "./embed.ts";

let parser = new Parser();
let renderer = new HtmlRenderer({ safe: true });

let toHTML = (str: string) => {
	let ast = parser.parse(str);
	let html = renderer.render(ast);
	return html;
}

const app: Application = new Application();
const userClients: UserClients = {}

app.renderer = {
	render<T>(name: string, data: T): Promise<Deno.Reader> {
		return renderFile(name, data);
	},
};

app.get("/", async (ctx: Context) => {
	await ctx.render("./public/index.html");
});

app.get("/getEmbed", async (ctx: Context) => {
	let embed = await getEmbed(ctx.queryParams.url as string);
	return embed;
});

app.post("/getData", async (ctx: Context) => {
	let query = await ctx.body() as {[key: string]: string};
	if(query.auth) {
		let client = await getClient(query.auth.toString());

		let messages: Message[] = [];
		if(query.room) {
			let room = client.channels.find((room: Channel) => room.token === query.room);
			if(room) {
				messages = await room.fetchMessages();
			}
		}


		let channels = [...client.channels.map(obj => Object.assign({}, obj))];
		channels.forEach((ch: Channel) => {
			delete ch.client;
		});
		messages = [...messages.map(obj => Object.assign({}, obj))];
		messages.forEach((msg: Message) => {
			msg.channel = Object.assign({}, msg.channel);
			msg.content = toHTML(msg.content);
			delete msg.channel.client;
		});

		return {
			channels,
			messages
		}
	} else {
		return {
			status: 403
		}
	}
});

interface PostMessageOptions {
	[key: string]: string;
}

app.post("/postMessage", async (ctx: Context) => {
	let query = await ctx.body() as PostMessageOptions;
	if(query.auth && query.room) {
		let client = await getClient(query.auth.toString());

		let messages: Message[] = [];
		if(query.room) {
			let room = client.channels.find((room: Channel) => room.token === query.room);
			if(room && query.v && typeof query.v === "string") {
				room.send(query.v);
			}
		}
		
		return {
			status: 200
		}
	} else {
		return {
			status: 403
		}
	}
});

app.static("/static", "public");

/** Get Client object based on user's authentication */
async function getClient(auth: string) {
	if(!userClients[auth]) {
		userClients[auth] = new Client({
			url: "box.ictmaatwerk.com",
			encoded: auth
		});
		await userClients[auth].start();
	}
	return userClients[auth];
}

app.get("/image/:id", async (ctx) => {
	let avatarReq = await fetch(`https://box.ictmaatwerk.com/avatar/${ctx.params.id}/256`, {
		headers: {
			"Ocs-Apirequest": "true",
			"Accept": "application/json, text/plain, */*",
			"Authorization": `Basic ${ctx.queryParams.auth}`
		}
	});
	// This will succeed
	let buffer = await avatarReq.arrayBuffer();
	let arr = new Uint8Array(buffer);
	return arr;
});

await app.start({ port: 8081 });
console.log("Started!");