import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from 'node-html-markdown'
import ollama from 'ollama'
import cliProgress from 'cli-progress'
import colors from 'ansi-colors'
import fs from 'fs';


const styleguide = [
  "https://www.gov.uk/api/content/guidance/style-guide/a-to-z",
  "https://www.gov.uk/api/content/guidance/style-guide/technical-content-a-to-z"
];
// TODO train on https://www.gov.uk/guidance/content-design/writing-for-gov-uk

const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{stage} | {bar} | {percentage}% | {value}/{total} | {duration_formatted} | {eta_formatted}',
}, cliProgress.Presets.shades_grey);


const fetchGuidesBar = multibar.create(styleguide.length, 0, { stage: "Fetch guides" });


async function parallel(arr: any[], fn: any, threads = 2) {
  const result = [];
  while (arr.length) {
    const res = await Promise.all(arr.splice(0, threads).map(x => fn(x)));
    result.push(res);
  }
  return result.flat();
}

const styleguides = await Promise.all(styleguide.map(async (url) => {
  const response = await fetch(url);
  const content = JSON.parse(await response.text()).details.body;
  const markdown = NodeHtmlMarkdown.translate(content, {});
  const split = markdown
    .split("\n## A\n")
    .slice(1)
    .join("\n")
    .split("\n## ")
    .join("\n")
    .split("\n### ")
    .filter(item => item.length > 0)
    .map(item => "### " + item)
    .filter(item => !/\n\nSee .*?\]/.test(item));
  fetchGuidesBar.increment();
  fetchGuidesBar.update();
  return split;
}));

fetchGuidesBar.stop()

const rows = 10

const system_prompt = `You are a world-class AI system, capable of complex reasoning and reflection. Reason through the query inside <thinking> tags, and then provide your final response inside <output> tags. If you detect that you made a mistake in your reasoning at any point, correct yourself inside <reflection> tags.

You are an expert assistant to supporting fine tune a large language model on the corporate style guide, so that it can provide helpful critical reviews of content before publishing.

You will be supplied the style guide rule in the format of:
\`rule_name\`: this will be the name of the rule, you should highlight this in your response to the user
\`explanation\`: this will be a description of the rule, you should use this to provide more context to the user on what they should be looking to correct and it will help you create more accurate prompts and responses
\`\`\`json
{
"rule_name": "Capitalisation",
"explanation": "Always use sentence case, even in page titles and service names."
}
\`\`\`
or
\`\`\`json
{
"rule_name": "A level",
"explanation": "No hyphen. Lower case level."
}
\`\`\`

Please produce at least ten prompts and responses formatted as a JSON array of objects with the keys \`prompt\`, \`text\`, \`rejected_text\`

\`prompt\` should be an example of content in the form of a full paragraph of plain text with no markdown or other formatting, at least fourty words that you might expect to find in some government citizen facing literature; which you have included one or more breaches from the style guide rule provided within it; each prompt should be unique and not similar in wording or meaning to any other.
\`text\` should be a highly accurate, specific, concise and polite suggestions to improve and align to the style guide rule provided by the user
\`rejected_text\` should be a suggestion that is not aligned to the style guide rule provided by the user, is not helpful, or suggesting there are no errors

example for fomatting only:
\`\`\`json
{"result": [{
  "prompt": "using web analytics and other data that's available (for example, from government call centres or third party services to enhance their understanding of the problem",
  "text": "Please ensure that the first letter of the first word in a sentence is capitalized", 
  "rejected_text": "looks good"
},
{
  "prompt": "the real problem might not be the one you originally thought needed solving. Testing your assumptions early and often reduces the risk of building the wrong thing.",
  "text": "Please capitalize the first word in the sentence",
  "rejected_text": "great job"
},
{
  "prompt": "we are looking for someone with at least 5 a-levels",
  "text": "Please correctly use 'A levels' instead of 'a-levels', note the capitalisation and lack of hypen",
  "rejected_text": "great job"
},
  ...${rows - 3} more
]}
\`\`\`

your response MUST be only a valid JSON including the specified keys with no deviation, no additional content, annotations or code block formatting.
Your response will be tested for validity and that it includes the correct correct keys and at least ${rows} items of data, if you get errors, do not appologise just fix the errors and respond with the valid JSON
Your response should not use any formatting or markdown, only plain text valid JSON
you must provide at least ${rows} even if that requires you to duplicate the same prompt multiple times with different responses
You MUST NOT use any external knowledge to produce this apart, it must be explicitly applied without deviating or introducing additional rules and context beyond that provided
`


const models = [
  'llama3.1',
  'llama3.1:70b-instruct-q2_K',
  'reflection:70b-q2_K'
  // 'phi3.5',
  // 'gemma2',
  // 'mistral',
  // 'mixtral',
]

async function chat(messages: any, model: string) {
  const response = await ollama.chat({
    model: model,
    messages: messages,
    format: "json",
    options: {
      temperature: 0.9,
      // top_p: 1,
      num_ctx: 128000,
      repetition_penalty: 1.1
    }
  })
  return response.message.content
}

const max_attempts = 15

async function generateTrainingData(style: string, model: string, bar: cliProgress.SingleBar) {

  let attempts = 1
  var style_prompt = format_style(style)
  var messages = [
    {
      role: "system",
      content: system_prompt
    },
    {
      role: "user",
      content: JSON.stringify(style_prompt)
    }
  ]

  var response = ''
  var parsed = {}
  while (attempts < max_attempts) {
    response = await chat(messages, model)
    console.log(response, style_prompt)
    let errors = []
    try {
      parsed = JSON.parse(response)
      if (!parsed.result) {
        errors.push("you've provided valid json but not included the key 'result'")
      }
      else if (!Array.isArray(parsed.result)) {
        errors.push("result is not an array")
      }
      else if (parsed.result.length < rows) {
        errors.push(`Not enough examples, you provided ${parsed.result.length} should be ${rows}`)
      }
      // else if (parsed.result.filter(item => Object.keys(item) !== 3).length > 0) {
      //   errors.push(`json doesn't match the schema`)
      // }

      // else {

      //   for (let i = 0; i < parsed.result.length; i++) {
      //     const item = parsed.result[i];
      //     // if (Object.keys(item) != ['prompt', 'text', 'rejected_text']) {
      //     if (Object.keys(item).length === 3 && !item.prompt || !item.text || !item.rejected_text) {
      //       errors.push(`Invalid item at index ${i} you must ONLY use the keys \`prompt, text, rejected_text\` you gave \`${Object.keys(item).join(", ")}\``)
      //     }
      //   }

      // }
    } catch (e) {
      errors.push(`Invalid JSON: ${e.message}`)
    }


    if (errors.length > 0) {
      messages.push({
        role: "assistant",
        content: response
      })
      messages.push({
        role: "user",
        content: errors.join("\n")
      })
      multibar.log(`ATTEMPT ${attempts}: ${errors.join(" ")}`)
    }
    else {
      break;
    }
    attempts++;
  }


  bar.increment()
  bar.update({ attempt: 1 })
  // multibar.log(response.response)
  return parsed.result
}


function format_style(style: string) {
  const lines = style.split('\n');
  let rule_name = '';
  let explanation = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('###')) {
      rule_name = line.substring(3).trim().replace(/\\/g, '');
    } else if (line !== '') {
      explanation += line.trim().replace(/\\/g, '') + '\n';
      break;
    }
  }
  return { rule_name, explanation };
}



await parallel(models, async (model: string) => {
  const styles = styleguides.flat()
  // .slice(0, 5)

  const bar = multibar.create(styles.length, 0, { stage: model, attempt: 1, max_attempts: max_attempts });

  try {
    const fullresponse = await parallel(styles, (guide: string) => generateTrainingData(guide, model, bar), 1)
    fs.writeFileSync(`${model.replace(":", "-")}.json`, JSON.stringify(fullresponse.flat()));
  } catch (e) {
    multibar.log(`${model} failed`)
  }
  bar.stop()

}, 1)


multibar.stop()