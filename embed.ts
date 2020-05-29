

/** Get HTML embed from URL */
export async function getEmbed(url: string): Promise<string> {

	url = url.split(":").slice(0, 2).join(":");; // Should help with URLs like https://deno.land/x/talk_lib/mod.ts:98:21)
	console.log(url);

	let embedReq = await fetch(url, {
		headers: {
			"Accept": "text/html"	
		}
	});
	let ct = embedReq.headers.get("content-type")?.split(";")[0];

	if(url.match(/https:\/\/imgur\.com\/(a\/)?(.+)/gi) && !url.includes("/embed")) { // Imgur embedding
		let body = await (await fetch(`${url.replace("/gallery", "")}/embed/`)).text();
		// Check for images
		let sourceMatch = body.match(/<img id="image-element" class="post" src="(\/\/i\.imgur\.com\/.+.+)" \/>/);
		if(sourceMatch && sourceMatch[1]) return `<img src="https:${sourceMatch[1]}" class="embed embedImage allowOpen" data-original="${url}">`;
	
		// Check for videos
		let gifMatch = body.match(/gifUrl: +'(.+)'/);
		if(gifMatch && gifMatch[1]) return `<img src="https:${gifMatch[1]}" class="embed embedImage allowOpen" data-original="${url}">`;
	} 
	
	if(url.match(/https:\/\/giphy\.com\/gifs\//gi) || url.match(/https:\/\/giphy\.com\/stories\//gi) || url.match(/https:\/\/tenor\.com\/view\//gi) || url.match(/https:\/\/gfycat\.com\/(.+)/gi)) { // Giphy & tenor embedding
		let html = await embedReq.text();
		let headHtml = getHeadHtml(html);

		let image;
		if(headHtml) image = getProperty(headHtml, ["apple-touch-icon", "twitter:image:src", "og:image", "icon"]);
		if(image) return `<img src="${image}" class="embed embedImage allowOpen" data-original="${url}">`;
	} 
	
	if(url.match(/https:\/\/media(\d)?\.giphy\.com\/media\//gi)) { // media.giphy.com embedding
		return `<img src="${url.replace(/\.webp/g, ".gif")}" class="embed embedImage allowOpen" data-original="${url}">`;
	} 
	
	if(url.match(/https:\/\/streamable\.com\/(.+)/gi)) {
		let html = await embedReq.text();
		let headHtml = getHeadHtml(html);
	
		let video, image;
		if(headHtml) {
			image = getProperty(headHtml, ["apple-touch-icon", "twitter:image:src", "og:image", "icon"]);
			video = getProperty(headHtml, ["og:video"]);
		}

		let validImage = image && image !== "undefined" && !image.endsWith("undefined")
		let showImage = validImage && !video; // If there's a video, use the image for the 

		if(video) return `<video class="embedVideo" src="${video}" ${validImage ? `poster="${image}"` : ""} controls></video>`;

	} 

	// YouTube embeds, obviously.
	let youtubeMatch = url.match(/https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9]+)/);
	if(youtubeMatch) {
		return `<iframe class="embed frameEmbed" width="560" height="315" src="https://www.youtube.com/embed/${youtubeMatch[1]}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
	}

	if(ct === "text/html" || ct === "text/plain") { // HTML pages
		let html = await embedReq.text();
		let headHtml = getHeadHtml(html);

		let title, description, image, video;
		if(headHtml) {
			title = getProperty(headHtml, ["og:title", "twitter:title", "title"]);
			description = getProperty(headHtml, ["og:description", "twitter:description", "description"]);
			image = getProperty(headHtml, ["apple-touch-icon", "twitter:image:src", "og:image", "icon"]);
			video = getProperty(headHtml, ["og:video"]);
		}

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

		let validImage = image && image !== "undefined" && !image.endsWith("undefined")
		let showImage = validImage; // If there's a video, use the image for the 
		
		if(validImage || title || description || video) {
			return `
			<div class="embed urlEmbed" data-has-image="${showImage}">
				${showImage ? `<div class="imageDiv"><img src="${image}" class="embedImage" onerror="embedError(this);"></div>` : ""}
				<div class="embedCore">
					${title ? `<h3 class="embedTitle">${title}</h3>` : ""}
					${url ? `<a href="${url}" target="_blank" class="embedUrl">${url.length > 100 ? url.slice(0, 100) + "..." : url}</a>` : ""}
					${description ? `<p class="embedDescription">${description}</p>` : ""}
					${video ? `<video class="embedVideo" src="${video}" ${validImage ? `poster="${image}"` : ""} controls></video>` : ""}
				</div>
			</div>
			`
		}
	}
	if(ct?.startsWith("image/")) { // Images, obviously
		return `<img src="${url}" class="embed allowOpen" data-original="${url}">`;
	}

	let html = await embedReq.text();
	let headHtml = getHeadHtml(html);

	let image;
	console.log(headHtml);

	return `<span class="embed noEmbed">No matched for ${url} with content-type ${ct}</span>`;
}

/** Get HEAD html from HTML string */
function getHeadHtml(html: string) {
	let headHtml;
	let headStart = html.split(/\<head ?([\n\t ]+)?(.+)?\>/).filter(i => i && i.includes("<")).slice(1).join("");
	if(headStart) headHtml = headStart ? headStart.split("</head>")[0] : null;
	return headHtml ?? "";	
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