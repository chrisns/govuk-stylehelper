import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from 'node-html-markdown'
import ollama from 'ollama'
import cliProgress from 'cli-progress'
import colors from 'ansi-colors'
import fs from 'fs';
import CSVValidator from '../node_modules/csv-validator-js/src/CSVValidator';


const styleguide = [
  "https://www.gov.uk/api/content/guidance/style-guide/a-to-z",
  "https://www.gov.uk/api/content/guidance/style-guide/technical-content-a-to-z"
];


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
  fetchGuidesBar.increment();
  fetchGuidesBar.update();
  return split;
}));

fetchGuidesBar.stop()

const rows = 10

const system_prompt = `You are an expert assistant to supporting fine tune a large language model on the corporate style guide, so that it can provide helpful critical reviews of content before publishing.

Please produce at least ten prompts and responses formatted as a csv with the headers \`prompt\`, \`text\`, \`rejected_text\`

\`prompt\` should be an example of content in the form a full paragraph of at least 50 words that you might expect to find in some government literature that includes one or more deviations from the style guide rule provided
\`text\` should be a short and polite suggestions to improve and align to the style guide rule provided by the user
\`rejected_text\` should be a suggestion that is not aligned to the style guide rule provided by the user, is not helpful, or suggesting there are no errors

your response MUST be only a valid CSV file including the headers with no additional content, annotations or code block formatting.
Your response will be tested for validity as a CSV file and that it includes the correct headers and at least ${rows} rows of data, if you get errors, do not appologise just fix the errors and respond with the valid csv
Your response should not use any formatting or markdown, only plain text valid CSV
you must provide at least ${rows} even if that requires you to duplicate the same prompt multiple times with different responses
You MUST NOT use any external knowledge to produce this apart, it must be explicitly applied without deviating or introducing additional rules and context beyond that provided`


const models = [
  'llama3.1',
  // 'phi3.5',
  // 'gemma2',
  // 'mistral',
  // 'mixtral',
  // 'mistral-nemo',
  // 'llama3.1:70b',
]

async function chat(messages: any, model: string) {
  const response = await ollama.chat({
    model: model,
    messages: messages,
    options: {
      temperature: 1,
      top_p: 1,
    }
  })
  return response.message.content
}

const columnDefinitions = {
  'prompt': { dataType: 'string', required: true },
  'text': { dataType: 'string', required: true },
  'rejected_text': { dataType: 'string', required: true },
};
const validator = new CSVValidator({
  columnDefinitions
});

function getCSVErrors(csv: string) {
  let errs = []
  validator.parseAndValidateCSVString(csv, (isValid, errors) => {
    if (isValid) {
      // console.log('CSV file is valid.');
    } else {
      // console.error('CSV file is invalid:');
      for (const [rowIndex, errorMessages] of Object.entries(errors)) {
        errs.push(`Row ${rowIndex}:`, errorMessages)
        // console.error(`Row ${rowIndex}:`, errorMessages);
      }
    }
  });
  return errs
}

async function generateTrainingData(style: string, model: string, bar) {

  let attempts = 0

  var messages = [
    {
      role: "system",
      content: system_prompt
    },
    {
      role: "user",
      content: style
    }
  ]

  var response = ''
  while (attempts < 15) {
    response = await chat(messages, model)
    let errors = getCSVErrors(response)
    console.log(errors, response)
    if (errors.length > 0) {
      messages.push({
        role: "assistant",
        content: response
      })
      messages.push({
        role: "user",
        content: errors.join("\n")
      })
    }
    attempts++;
  }
  console.log(response)

  // const response = await ollama.chat({
  //   model: model,
  //   messages: [
  //     {
  //       role: "system",
  //       content: system_prompt
  //     },
  //     {
  //       role: "user",
  //       content: style
  //     }
  //   ],
  //   options: {
  //     temperature: 1,
  //     top_p: 1,
  //   }
  // })

  bar.increment()
  bar.update()
  console.log(response)
  // multibar.log(response.response)
  return response.response
}
// async function generateTrainingData(style: string, model: string, bar) {
//   const response = await ollama.generate({
//     model: model,
//     system: system_prompt,
//     prompt: style,
//     options: {
//       temperature: 1,
//       top_p: 1,
//     }
//   })
//   bar.increment()
//   bar.update()
//   console.log(response)
//   // multibar.log(response.response)
//   return response.response
// }


const styles = styleguides.flat()
  .slice(0, 2)


// Rest of the code...

await parallel(models, async (model: string) => {
  const bar = multibar.create(styles.length, 0, { stage: model })

  try {
    const fullresponse = await parallel(styles, (guide: string) => generateTrainingData(guide, model, bar), 5)
    fs.writeFileSync(`${model.replace(":", "-")}.csv`, fullresponse.join("\n"));
  } catch (e) {
    multibar.log(`${model} failed`)
  }
  bar.stop()

}, 1)


multibar.stop()