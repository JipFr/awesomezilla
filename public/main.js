const projectOpts = {
	rootUrl: location.host,
	protocol: location.protocol.replace(/:/g, "")
}

let data = {
	channels: [],
	messages: []
};
let urlMatch = location.href.match(/\?r=(.+)/);
let roomToken = urlMatch ? urlMatch[1] : null;
let urlCache = {};
let peopleImgCache = {};
let roomImageCache = {};

/**
 * Correct room image's source
 * @param imgElement <img> element
 */
function correctRoomImage(imgElement) {
	let wrapper = imgElement.closest("[data-token]");
	let token = wrapper.dataset.token;
	roomImageCache[token] = "/static/img/group.png"
	imgElement.src = roomImageCache[token];
}

/**
 * Store room image's source as b64 to prevent flickering
 * @param imgElement <img> element
 */
function storeRoomImage(imgElement) {
	let wrapper = imgElement.closest("[data-token]");
	let token = wrapper.dataset.token;
	if(!roomImageCache[token]) {
		// Get base64 URL for image
		let canvas = document.createElement("canvas");
		let ctx = canvas.getContext("2d");
		canvas.width = imgElement.naturalWidth;
		canvas.height = imgElement.naturalHeight;
		ctx.drawImage(imgElement, 0, 0);

		roomImageCache[token] = canvas.toDataURL();
		imgElement.src = roomImageCache[token];
	}
}

/**
 * Correct image's source
 * @param imgElement <img> element
 */
function correctImage(imgElement) {
	let userId = imgElement.closest(".message").dataset.user;
	if (!peopleImgCache[userId]) {
		peopleImgCache[userId] = {
			bg: Math.floor(Math.random() * 16777215).toString(16), // Generates `#4c4c4c` like string without the hashtag
			userName: imgElement.closest(".message").querySelector(".name").innerText
		}
	}
	imgElement.src = `/placeholderImage/300/${peopleImgCache[userId].bg}/fff?text=${peopleImgCache[userId].userName.slice(0, 1).toUpperCase()}`
	// imgElement.src = `/static/img/u-not-found.png`;
}

function getAuth() {
	if (!localStorage.getItem("auth")) {
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
	for (let room of data.channels) {
		let node = document.importNode(document.querySelector("template.room").content, true).querySelector("*");

		node.setAttribute("data-token", room.token);
		let roomName = parseRoomName(room.displayName || room.name);
		// Room's image
		node.querySelector(".roomImage").src = roomImageCache[room.token] || `/image/${room.name}?auth=${getAuth()}`;
		// Channel's name, say "Embed preview" or "Jip BOT"
		node.querySelector(".channelName").innerText = room.displayName || room.name;
		// Last message author & content
		node.querySelector(".body .authorName").innerText = room.lastMessage.actorId !== atob(getAuth()).split(":")[0] ? (room.lastMessage.actorDisplayName || room.lastMessage.actorId).split(" ")[0] : "Jij";
		node.querySelector(".body .lastMessage").innerHTML = toBodyText(room.lastMessage.message.slice(0, 200), room.lastMessage)[0]; // 200 for no real reason.
		node.href = `?r=${room.token}`;
		if (room.token === roomToken) {
			node.classList.add("current");
			document.querySelector("header .core .title .roomName").innerText = room.displayName || room.name;
			document.querySelector("header .core .title .roomHashtag").innerText = `#${roomName}`;
		}
		if (room.unreadMessages > 0) node.classList.add("unread");
		if (room.unreadMention) node.classList.add("unreadMention");

		wrapper.appendChild(node);

		// HR
		wrapper.appendChild(document.createElement("hr"));

	}
}
function renderChat() {
	let shouldScroll = (window.innerHeight + window.scrollY) >= document.body.offsetHeight;
	let wrapper = document.querySelector(".messages");

	data.messages.forEach(msg => {
		msg.date = new Date(msg.timestamp);
	});
	data.messages = data.messages.sort((a, b) => a.date - b.date);

	data.messages = data.messages.filter(msg => !wrapper.querySelector(`[data-id="${msg.id}"]`))

	if (data.messages.length > 0) {
		wrapper.querySelectorAll(`.message .body p[data-is-fake="true"]`).forEach(msg => {
			msg.remove();
		});
	}

	for (let message of data.messages) {

		let divs = [...document.querySelectorAll(".messages > *")];

		let lastDate = divs.length > 0 ? divs.pop().getAttribute("data-iso-8601") : "-1";
		let msgDate = getISO8601(new Date(message.timestamp));
		if (lastDate !== msgDate && lastDate) {
			let hr = document.createElement("div");
			hr.innerHTML = `
				<p class="dateString">${msgDate}</p>
				<hr>
			`;
			wrapper.appendChild(hr);
		}

		// Update divs variable with the new HR
		divs = [...document.querySelectorAll(".messages > *")];

		if (divs.length > 0 && divs[divs.length - 1].getAttribute("data-user") !== message.author.id) {
			let node = getMessageNode(message);
			node.setAttribute("data-is-skeleton", !!message.skeleton);

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


	if (shouldScroll) {
		window.scrollTo(0, document.body.offsetHeight);
	}

	updateEmbeds();

}

async function updateEmbeds() {
	let links = [...document.querySelectorAll(`.message p[data-id][data-is-fake="false"] a`)];
	let hrefs = links.map(el => el.href).filter(link => typeof urlCache[link] === "undefined");
	for (let url of hrefs) {
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

function embedError(imgElement) {
	imgElement.closest("[data-has-image]").setAttribute("data-has-image", false);
	imgElement.closest(".imageDiv").remove();
}

function drawEmbeds() {
	let shouldScroll = (window.innerHeight + window.scrollY) >= document.body.offsetHeight;
	// Now actually add the nodes...
	let links = [...document.querySelectorAll(".messages a.doEmbed")];
	for (let a of links) {
		if (!a.getAttribute("data-rendered-embed") && urlCache[a.href]) {
			let p = a.closest("p[data-id]");
			if (!p.querySelector(".embedWrapper")) {
				let div = document.createElement("div");
				div.classList.add("embedWrapper");
				p.appendChild(div);
			}

			p.querySelector(".embedWrapper").innerHTML += urlCache[a.href] || "";
			p.querySelectorAll(".embedWrapper img").forEach(el => {
				el.addEventListener("load", () => {
					if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - el.scrollHeight) {
						window.scrollTo(0, document.body.offsetHeight);
					}
				});
			})
			a.setAttribute("data-rendered-embed", true);
		}

	}

	if (shouldScroll) {
		window.scrollTo(0, document.body.offsetHeight);
	}

}


function getMessageNode(message) {
	let node = document.importNode(document.querySelector("template.message").content, true).querySelector("*");
	node.setAttribute("data-user", message.author.id);
	node.setAttribute("data-iso-8601", getISO8601(new Date(message.timestamp)));

	let userDiv = document.querySelector(`[data-user="${message.author.id}"]`);
	let authorName = message.author.name || (userDiv && userDiv.querySelector ? userDiv.querySelector(".name").innerText : message.author.id);
	node.querySelector(".name").textContent = authorName !== "Unknown factor" ? authorName : "Unknown user";
	node.querySelector(".time").textContent = `${message.date.getHours().toString().padStart(2, "0")}:${message.date.getMinutes().toString().padStart(2, "0")}`;

	node.querySelector(".authorImg").src = `/image/${message.author.id}?auth=${getAuth()}`

	return node;
}

function toBodyText(str, message) {
	let suffix = "";
	// Match & replace URLs
	let urlRegex = /(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/g;
	let urlMatch = str.match(urlRegex);
	if (urlMatch) {
		let index = str.indexOf(urlMatch);
		if (str[index - 1] !== `"`) str = str.replace(urlRegex, `<a class="link doEmbed" href="$1" target="_blank">$1</a>`);
	}

	let par = message.parameters || message.messageParameters;
	for (let key of Object.keys(par)) {
		let replacingStr = `{${key}}`;
		if (par[key].type === "user") {
			let newStr = `<span class="parameter">@${par[key].name}</span>`;
			while (str.includes(replacingStr)) {
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
	if (messages.length > 0) {
		lastTime = Number(messages.pop().dataset.timestamp);
	}

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
	data.messages = data.messages.filter(msg => !msg.skeleton);
	data = await dataReq.json();
}

function getISO8601(d) {
	return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`
}

function updateInputHeight(input = document.querySelector(".inputDiv .messageBox")) {
	document.body.setAttribute("style", `--inputHeight: 0;`);
	document.body.setAttribute("style", `--inputHeight: ${Math.max(input.scrollHeight - 16, 50)}px;`);
	window.scrollTo(0, document.body.offsetHeight);
}

// This is fired by the MutationObserver
function storeSidebarWidth() {
	localStorage.setItem("sidebarWidth", document.querySelector("aside").style.width);
	document.body.setAttribute("style", `--sidebarWidth: ${localStorage.getItem("sidebarWidth")}`);
}

async function init() {

	document.body.setAttribute("data-is-ios", /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);

	if(localStorage.getItem("sidebarWidth") && document.body.getAttribute("data-is-ios") === "false") {
		document.body.setAttribute("style", `--sidebarWidth: ${localStorage.getItem("sidebarWidth")}`);
	}

	const ipsum = "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed ddolor sit amet, consetetur sadipscing elitr,";
	for (let i = 0; i < 20; i++) {
		let index = Math.floor(Math.random() * ipsum.length);
		let random = Math.floor(Math.random() * 5)
		data.messages.push({
			content: ipsum.slice(index),
			author: {
				id: "fake.person" + "0".repeat(random)
			},
			parameters: {},
			timestamp: new Date(),
			fake: true,
			skeleton: true
		});
	}
	renderChat();

	let sidebarObserver = new MutationObserver(storeSidebarWidth);
	sidebarObserver.observe(document.querySelector("aside"), {
		attributes: true
	});

	document.querySelector(".showSidebar").addEventListener("click", evt => {
		if (document.body.dataset.focus === "aside") {
			document.body.setAttribute("data-focus", "core");
		} else {
			document.body.setAttribute("data-focus", "aside");
			window.scrollTo(0, 0);
		}
	});

	document.querySelector(".inputDiv .send").addEventListener("click", sendMessage);
	document.querySelector(".messageBox").addEventListener("input", evt => {
		updateInputHeight(evt.currentTarget);
	});

	document.querySelector(".messageBox").addEventListener("keyup", evt => {
		if (evt.key === "Enter" && !evt.shiftKey) {
			sendMessage();
		}
	});

	loopMain(true); // It's init, so I'm passing true

}

function sendMessage() {
	let input = document.querySelector(".messageBox");
	let v = input.innerText;
	input.innerHTML = "";

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

function loopMain(init = false) {
	main().then(() => {
		if(init) document.body.classList.add("loaded");
		setTimeout(loopMain, 3e3);
	});
}

async function main() {
	await updateData();

	// Remove all skeleton divs
	document.querySelectorAll(`[data-is-skeleton="true"]`).forEach(el => el.remove());
	// Sort channels by latest message
	data.channels = data.channels.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);

	// Render rooms & chat
	renderRooms();
	renderChat();
}

init();