import { Application, Router, Context } from "https://deno.land/x/denotrain@v0.4.0/mod.ts";
import { TrainStatic } from "https://deno.land/x/denotrain@v0.4.0/middleware/static/mod.ts";
import { Client, Message, Channel } from "https://deno.land/x/talk_lib/mod.ts"
import { UserClients } from "./classes.ts";
import {Parser, HtmlRenderer} from "https://cdn.pika.dev/commonmark@0.29.1"
import { getEmbed } from "./embed.ts";

let parser = new Parser()
let renderer = new HtmlRenderer({safe: true})

let toHTML = (str: string) => {
	let ast = parser.parse(str);
	let html = renderer.render(ast);
	return html;
}

const app: Application = new Application({ port: 8081 });
const userClients: UserClients = {}

app.use(ctx => {
	ctx.res.addHeader("Access-Control-Allow-Origin", "*");
	return;
});

app.get("/getEmbed", async (ctx: Context) => {
	let embed = await getEmbed(ctx.req.query.url as string);
	return embed;
});

app.post("/getData", async (ctx: Context) => {
	let query = ctx.req.body;
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

app.post("/postMessage", async (ctx: Context) => {
	let query = ctx.req.body;
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

app.use("/", new TrainStatic("./public"));


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


await app.run();
console.log(1);