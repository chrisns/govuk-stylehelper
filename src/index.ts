export interface Env {
	AI: Ai;
}


export default {
	async fetch(request, env): Promise<Response> {
		// const response = await env.AI.run(
		// 	"@cf/google/gemma-2b-it-lora",
		// 	{
		// 		messages: [{ "role": "user", "content": "Hello world" }],
		// 		raw: true,
		// 		// stream: true,
		// 		max_tokens: 512,
		// 		lora: "govuk-stylehelper-0.5",
		// 	}
		// );

		const response = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.1',
			{
				// stream: true,
				raw: true,
				messages: [
					{
						"role": "user",
						"content": "Summarize the following: Some newspapers, TV channels and well-known companies publish false news stories to fool people on 1 April. One of the earliest examples of this was in 1957 when a programme on the BBC, the UKs national TV channel, broadcast a report on how spaghetti grew on trees. The film showed a family in Switzerland collecting spaghetti from trees and many people were fooled into believing it, as in the 1950s British people didnt eat much pasta and many didnt know how it was made! Most British people wouldnt fall for the spaghetti trick today, but in 2008 the BBC managed to fool their audience again with their Miracles of Evolution trailer, which appeared to show some special penguins that had regained the ability to fly. Two major UK newspapers, The Daily Telegraph and the Daily Mirror, published the important story on their front pages."
					}
				],
				lora: "cf-public-cnn-summarization"
			});
		// 	const styleguides = await Promise.all(styleguide.map(async (url) => {
		// 		const response = await fetch(url);
		// 		const content = JSON.parse(await response.text()).details.body;
		// 		const markdown = NodeHtmlMarkdown.translate(content, {});
		// 		return markdown;
		// 	}));

		// console.log(styleguides.join("---").length);


		// const answer = await env.AI.run("@hf/mistral/mistral-7b-instruct-v0.2", {
		// 	stream: true,
		// 	messages: [
		// 		{
		// 			role: "system", content: `You are an expert and ruthlessly pedantic content reviewer. Using no prior knowledge you will review the content provided by the user and respond with a critical review highlighting where their content has deviated from the provided style guide with short and practical advice on how to correct it.`
		// 		},


		// 		{ role: "user", content: `NCSC are great` }

		// 	],
		// });

		// console.log(answer)
		// return new Response(answer, {
		// 	headers: {
		// 		"content-type": "text/event-stream",
		// 	},
		// })
		// const response = await env.AI.run("@hf/thebloke/zephyr-7b-beta-awq", {
		// 	prompt: "What is the origin of the phrase Hello, World",
		// });

		// return new Response(styleguides.join("---"));
		// return new Response(JSON.stringify(response));
		return new Response(response,
			{ headers: { "content-type": "text/event-stream" } }
		);
	},
} satisfies ExportedHandler<Env>;


async function getContentReview(body) {
	return "Hello World!";
}

// email handler:


// import { EmailMessage } from "cloudflare:email";
// import { createMimeMessage } from "mimetext";

// const sender_email = "govstyle@cns.me";

// export default {
// 	async email(message, _: any, __: any) {



// 		const reviewbody = await getContentReview(message.body);
// 		const msg = createMimeMessage();
// 		msg.setHeader("In-Reply-To", message.headers.get("Message-ID"));
// 		msg.setSender({ name: "GOV UK Style Review Bot", addr: sender_email });
// 		msg.setRecipient(message.from);
// 		msg.setSubject(`re: ${message.subject}`);
// 		msg.addMessage({
// 			contentType: 'text/plain',
// 			data: `Thanks for asking for a review!\nI am a dumb AI, so take it with a pinch of salt and always use your best judgement and check the styleguides!\nHeres what I think: \n\n ${reviewbody}`
// 		});

// 		const replyMessage = new EmailMessage(
// 			sender_email,
// 			message.from,
// 			msg.asRaw()
// 		);

// 		await message.reply(replyMessage);
// 	}
// }