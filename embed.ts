/** Get HTML embed from URL */
export async function getEmbed(url: string): Promise<string> {

	let embedReq = await fetch(url, {
		headers: {
			"Accept": "text/html"	
		}
	});
	let ct = embedReq.headers.get("content-type")?.split(";")[0];

	let imgurMatch = url.match(/https:\/\/imgur\.com\/(a\/)?(.+)/gi);
	// Imgur protocol
	if(imgurMatch) {
		let imgurId = url.split("/").filter(i => i).pop();
		let isAlbum = url.includes("/a/");
		return `<iframe src="${url}/embed" scrolling="no" class="embedFrame"></iframe>`
	} else if(ct === "text/html" || ct === "text/plain") { // HTML pages
		let html = await embedReq.text();
		let headHtml;
		let headStart = html.split("<head>")[1];
		if(!headStart) console.log(html);
		headHtml = headStart ? headStart.split("</head>")[0] : null;	

		let title, description, image;
		if(headHtml) title = getProperty(headHtml, ["og:title", "twitter:title", "title"]);
		if(headHtml) description = getProperty(headHtml, ["og:description", "twitter:description", "description"]);
		if(headHtml) image = getProperty(headHtml, ["apple-touch-icon", "twitter:image:src", "og:image", "icon"]);

		// Image URLs are going to require some work... This is NOWHERE NEAR perfect!!
		if(!image?.startsWith("http")) {
			// Clone URL
			let tmpUrl = url + "";
			tmpUrl = tmpUrl.split("/").slice(0, -1).join("/")
			
			if(image?.startsWith("/")) {
				tmpUrl = tmpUrl.split("/").slice(0, 3).join("/");
			}

			if(!image?.startsWith("/")) image = `/${image}`;
			image = `${tmpUrl}${image}`;
		}

		// Shorten description...
		if(description && description.length > 200) {
			description = description?.slice(0, 200) + "...";
		}

		return `
		<div class="embed urlEmbed" data-has-image="${!!image}">
			${image ? `<div class="imageDiv"><img src="${image}" class="embedImage"></div>` : ""}
			<div class="embedCore">
				${title ? `<h3 class="embedTitle">${title}</h3>` : ""}
				${description ? `<p class="embedDescription">${description}</p>` : ""}
			</div>
		</div>
		`
	} else if(ct?.startsWith("image/")) { // Images, obviously
		return `<img src="${url}" class="embed">`
	}

	return `Unknown content type for ${url}: ${ct}`;
}

/** Get propery from head HTML
 * @param headHtml HTML for the head
 * @param values Array of allowed keys in the order of priority, e.g ["og:title", "twitter:title", "title"]
 */
function getProperty(headHtml: string, values: string[]) {

	let lines = headHtml.trim().split(/(?=\<)/).map(v => v.trim()).filter(Boolean);

	for(let line of lines) {
		for(let key of values) {
			
			let content;
			if(line.includes(`property="${key}"`) || line.includes(`name="${key}"`) || line.includes(`rel="${key}"`)) {
				content = line.match(/href="(.+)"/) || line.match(/content="(.+)"/);
			}
			if(content) {
				return content[1];
			}
		}
	}

	// Support for <title>Hello world!</title>
	let titleMatch;
	if(values.includes("title")) titleMatch = headHtml.match(/<title>(.+)<\/title>/);
	if(titleMatch) {
		return titleMatch[1];
	}
}