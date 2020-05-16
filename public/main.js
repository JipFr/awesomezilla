const projectOpts = {
	rootUrl: location.host,
	protocol: "http"
}

let data;
let urlMatch = location.href.match(/\?r=(.+)/);
let roomToken = urlMatch ? urlMatch[1] : null;
let people = {};
let urlCache = {};

function getAuth() {
	if(!localStorage.getItem("auth")) {
		let username = prompt("Your username");
		let password = prompt("Your password");
		let b64 = btoa(`${username}:${password}`);
		localStorage.setItem("auth", b64);
	}
	return localStorage.getItem("auth");
}

function renderRooms() {
	let wrapper = document.querySelector(".rooms");
	wrapper.innerHTML = "";
	for(let room of data.channels) {
		let node = document.importNode(document.querySelector("template.room").content, true).querySelector("*");

		let roomName = parseRoomName(room.displayName || room.name);
		node.querySelector(".channelName").innerText = roomName;
		node.href = `?r=${room.token}`;
		if(room.token === roomToken) {
			node.classList.add("current");
			document.querySelector("header .core .title .roomName").innerText = room.name;
			document.querySelector("header .core .title .roomHashtag").innerText = `#${roomName}`;
		}
		if(room.unreadMessages > 0) node.classList.add("unread");
		if(room.unreadMention) node.classList.add("unreadMention");

		wrapper.appendChild(node);
	}
}
function renderChat() {
	let shouldScroll =  (window.innerHeight + window.scrollY) >= document.body.offsetHeight;
	let wrapper = document.querySelector(".messages");

	data.messages.forEach(msg => {
		msg.date = new Date(msg.timestamp);
	});
	data.messages = data.messages.sort((a, b) => a.date - b.date);

	data.messages = data.messages.filter(msg => !wrapper.querySelector(`[data-id="${msg.id}"]`))
	
	if(data.messages.length > 0) {
		wrapper.querySelectorAll(`.message .body p[data-is-fake="true"]`).forEach(msg => {
			msg.remove();
		});	
	}

	for(let message of data.messages) {
			
		let divs = [...document.querySelectorAll(".messages > *")];

		let lastDate = divs.length > 0 ? divs.pop().getAttribute("data-iso-8601") : "-1";
		let msgDate = getISO8601(new Date(message.timestamp));
		if(lastDate !== msgDate && lastDate) {
			let hr = document.createElement("div");
			hr.innerHTML = `
				<p class="dateString">${msgDate}</p>
				<hr>
			`;
			wrapper.appendChild(hr);
		}

		// Update divs variable with the new HR
		divs = [...document.querySelectorAll(".messages > *")];

		if(divs.length > 0 && divs[divs.length - 1].getAttribute("data-user") === message.author.id) {
			
		} else {
			let node = getMessageNode(message);

			// Now add it to the DOM
			wrapper.appendChild(node);
		}

		// Update the divs _again_
		divs = [...document.querySelectorAll(".messages > *")];
			
		// Instead of doing the name & profile picture again,
		// add another paragraph.
		let p = document.createElement("p");
		let msg = toBodyText(message.content, message);
		p.innerHTML = msg[0];
		p.setAttribute("data-id", message.id);
		p.setAttribute("data-is-fake", !!message.fake);
		divs.pop().querySelector(".messageCore .body").appendChild(p);
		
	}


	if(shouldScroll) {
		window.scrollTo(0, document.body.offsetHeight);
	}

	updateEmbeds();

}

async function updateEmbeds() {
	let links = [...document.querySelectorAll(`.message p[data-id][data-is-fake="false"] a`)];
	let hrefs = links.map(el => el.href).filter(link => typeof urlCache[link] === "undefined");
	for(let url of hrefs) {
		// That means loading...
		urlCache[url] = "";
		// Keep everything going, but still get an async function
		(async () => {
			let embedReq = await fetch("/getEmbed?url=" + url);
			let embedHTML = await embedReq.text();
			urlCache[url] = embedHTML;
			drawEmbeds();
		})();
		
	}
	drawEmbeds();
}

function drawEmbeds() {
	let shouldScroll =  (window.innerHeight + window.scrollY) >= document.body.offsetHeight;
	// Now actually add the nodes...
	let links = [...document.querySelectorAll("a.doEmbed")];
	for(let a of links) {
		if(!a.getAttribute("data-rendered-embed") && urlCache[a.href]) {
			let p = a.closest("p[data-id]");
			if(!p.querySelector(".embedWrapper")) {
				let div = document.createElement("div");
				div.classList.add("embedWrapper");
				p.appendChild(div);
			}

			p.querySelector(".embedWrapper").innerHTML += urlCache[a.href] || "";
			p.querySelectorAll(".embedWrapper img").forEach(el => {
				el.addEventListener("load", () => {		
					if((window.innerHeight + window.scrollY) >= document.body.offsetHeight - el.scrollHeight) {
						window.scrollTo(0, document.body.offsetHeight);
					}
				});
			})
			a.setAttribute("data-rendered-embed", true);
		}

	}

	if(shouldScroll) {
		window.scrollTo(0, document.body.offsetHeight);
	}

}


function getMessageNode(message) {
	let node = document.importNode(document.querySelector("template.message").content, true).querySelector("*");
	node.setAttribute("data-user", message.author.id);
	node.setAttribute("data-iso-8601", getISO8601(new Date(message.timestamp)));

	let userDiv = document.querySelector(`[data-user="${message.author.id}"]`);
	let authorName = message.author.name || userDiv.querySelector(".name").innerText;
	node.querySelector(".name").textContent = authorName !== "Unknown factor" ? authorName : "Unknown user";
	node.querySelector(".time").textContent = `${message.date.getHours().toString().padStart(2, "0")}:${message.date.getMinutes().toString().padStart(2, "0")}`;

	node.querySelector(".authorImg").src = `https://box.ictmaatwerk.com/avatar/${message.author.id}/256`

	return node;
}

function toBodyText(str, message) {
	let suffix = "";
	// Match & replace URLs
	let urlRegex = /(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g;
	let urlMatch = str.match(urlRegex);
	if(urlMatch) {
		let index = str.indexOf(urlMatch);
		if(str[index - 1] !== `"`) str = str.replace(urlRegex, `<a class="link doEmbed" href="$1" target="_blank">$1</a>`);
	}

	let par = message.parameters;
	for(let key of Object.keys(par)) {
		let replacingStr = `{${key}}`;
		if(par[key].type === "user") {
			let newStr = `<span class="parameter">@${par[key].name}</span>`;
			while(str.includes(replacingStr)) {
				str = str.replace(replacingStr, newStr);
			}
		}
	}

	// We need a node for HLJS to highlight,
	// so that's what we're doing.
	let div = document.createElement("div");
	div.innerHTML = str;
	div.querySelectorAll("pre code").forEach(block => {
		hljs.highlightBlock(block);

		let parent = block.parentNode;
		parent.outerHTML = `<div class="codeWrapper">${parent.outerHTML}</div>`

	})

	return [div.innerHTML, suffix];
}

function parseRoomName(str) {
	return str.replace(/[^a-zA-Z 0-9]/g, "").toLowerCase().trim().replace(/ /g, "-");
}

async function updateData() {
	let messages = [...document.querySelectorAll(".messages .message")];

	let lastTime = 0;
	if(messages.length > 0) {
		lastTime = Number(messages.pop().dataset.timestamp);
	}

	//?room=${roomToken}&auth=${getAuth()}&since=${lastTime}
	let dataReq = await fetch(`${projectOpts.protocol}://${projectOpts.rootUrl}/getData`, {
		method: "POST",
		headers: {
			"content-type": "application/json"
		},
		body: JSON.stringify({
			room: roomToken,
			auth: getAuth(),
			since: lastTime
		})
	});
	data = await dataReq.json();
}

function getISO8601(d) {
	return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`
}

function updateInputHeight(input = document.querySelector(".inputDiv .messageBox")) {
	document.body.setAttribute("style", `--inputHeight: 0;`);
	document.body.setAttribute("style", `--inputHeight: ${input.scrollHeight + 2}px;`);
	window.scrollTo(0, document.body.offsetHeight);
}

async function init() {

	document.querySelector(".messageBox").addEventListener("input", evt => {
		updateInputHeight(evt.currentTarget);
	});

	document.querySelector(".messageBox").addEventListener("keyup", evt => {
		if(evt.key === "Enter" && !evt.shiftKey) {
			let v = evt.currentTarget.value;
			evt.currentTarget.value = "";

			data.messages.push({
				content: v,
				author: {
					id: atob(getAuth()).split(":")[0]
				},
				parameters: {},
				timestamp: new Date(),
				fake: true
			});

			renderChat();
			updateInputHeight();

			fetch(`/postMessage`, {
				method: "POST",
				headers: {
					"content-type": "application/json"
				},
				body: JSON.stringify({
					v,
					room: roomToken,
					auth: getAuth()
				})
			}).then(main);
		}
	});

	loopMain();

}

function loopMain() {
	main().then(() => {
		setTimeout(loopMain, 3e3);
	})
}

async function main() {
	await updateData();

	data.channels = data.channels.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);

	renderRooms();
	renderChat();
}

init();