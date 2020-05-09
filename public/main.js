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

		node.querySelector(".channelName").innerText = parseRoomName(room.displayName || room.name);
		node.href = `?r=${room.token}`;
		if(room.token === roomToken) {
			node.classList.add("current");
		}
		if(room.unreadMessages > 0) node.classList.add("unread");
		if(room.unreadMention) node.classList.add("unreadMention");

		wrapper.appendChild(node);
	}
}
function renderChat() {
	let shouldScroll =  (window.innerHeight + window.scrollY) >= document.body.offsetHeight;
	let wrapper = document.querySelector(".messages");
	for(let message of data.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())) {
		if(!wrapper.querySelector(`[data-id="${message.id}"]`)) {
			
			let messages = [...wrapper.querySelectorAll(".message")];

			if(messages.length > 0 && messages[messages.length - 1].getAttribute("data-user") === message.author.id) {
				let paragraphs = message.content.split("\n\n");
				for(let paragraph of paragraphs) {
					let p = document.createElement("p");
					p.innerText = paragraph;
					p.setAttribute("data-id", message.id);
					messages.pop().querySelector(".messageCore .body").appendChild(p);
				}
			} else {
				let node = document.importNode(document.querySelector("template.message").content, true).querySelector("*");
				node.setAttribute("data-user", message.author.id);

				node.querySelector(".name").textContent = message.author.name;

				node.querySelector(".authorImg").src = `https://box.ictmaatwerk.com/avatar/${message.author.id}/256`
				let paragraphs = message.content.split("\n\n");
				for(let paragraph of paragraphs) {
					let p = document.createElement("p");
					p.innerText = paragraph;
					p.setAttribute("data-id", message.id);
					node.querySelector(".messageCore .body").appendChild(p);
				}

				wrapper.appendChild(node);
			}
			
			
		}
	}


	if(shouldScroll) {
		window.scrollTo(0, document.body.offsetHeight);
	}

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

	let dataReq = await fetch(`${projectOpts.protocol}://${projectOpts.rootUrl}/getData?room=${roomToken}&auth=${getAuth()}&since=${lastTime}`, {
		method: "POST"
	});
	data = await dataReq.json();
}

async function init() {

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
	console.log(data);
}

init();