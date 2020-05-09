const projectOpts = {
	rootUrl: "localhost:8081",
	protocol: "http"
}

let data;
let urlMatch = location.href.match(/\?r=(.+)/);
let roomToken = urlMatch ? urlMatch[1] : null;

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

	for(let message of data.messages) {
		if(!wrapper.querySelector(`[data-id="${message.id}"]`)) {
			
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
				let p = document.createElement("p");
				let msg = toBodyText(message.content, message);
				p.innerHTML = msg[0];
				p.setAttribute("data-id", message.id);
				divs.pop().querySelector(".messageCore .body").appendChild(p);
			} else {
				let node = document.importNode(document.querySelector("template.message").content, true).querySelector("*");
				node.setAttribute("data-user", message.author.id);
				node.setAttribute("data-iso-8601", getISO8601(new Date(message.timestamp)));


				node.querySelector(".name").textContent = message.author.name !== "Unknown factor" ? message.author.name : "Unknown user";

				node.querySelector(".authorImg").src = `https://box.ictmaatwerk.com/avatar/${message.author.id}/256`
				
				// Body's text
				let p = document.createElement("p");
					
				let msg = toBodyText(message.content, message);
				p.innerHTML = msg[0];
				p.setAttribute("data-id", message.id);
					
				node.querySelector(".messageCore .body").appendChild(p);

				// Now add it to the DOM
				wrapper.appendChild(node);
			}
			
			
		}
	}


	if(shouldScroll) {
		window.scrollTo(0, document.body.offsetHeight);
	}

}

function toBodyText(str, message) {
	let suffix = "";
	str = str.replace(/</g, "&lt;").replace(/\n/g, "<br>").split(" ");


	for(let i = 0; i < str.length; i++) {
		// URL match
		if(str[i].match(/https?:\/\//)) {
			str[i] = `<a target="_blank" href="${str[i]}" class="link doEmbed">${str[i]}</a>`;
		}
	}

	str = str.join(" ");

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

	return [str, suffix];
}

function parseRoomName(str) {
	return str.replace(/[^a-zA-Z ]/g, "").toLowerCase().trim().replace(/ /g, "-");
}

async function updateData() {
	let messages = [...document.querySelectorAll(".messages .message")];

	let lastTime = 0;
	if(messages.length > 0) {
		lastTime = Number(messages.pop().dataset.timestamp);
	}

	//?room=${roomToken}&auth=${getAuth()}&since=${lastTime}
	let dataReq = await fetch(`${projectOpts.protocol}://${projectOpts.rootUrl}/getData?room=${roomToken}&auth=${getAuth()}&since=${lastTime}`, {
		method: "POST"
	});
	data = await dataReq.json();
}

function getISO8601(d) {
	return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`
}

async function init() {

	document.querySelector(".messageBox").addEventListener("keyup", evt => {
		if(evt.key === "Enter") {
			let v = evt.currentTarget.value;
			evt.currentTarget.value = "";
			fetch(`/postMessage?v=${encodeURIComponent(v)}&room=${roomToken}&auth=${getAuth()}`, {
				method: "POST"
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