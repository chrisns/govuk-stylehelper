
import fs from 'fs'
import { json2csv } from 'json-2-csv';

// open and parse the llama3.1.json file

const data = JSON.parse(fs.readFileSync('llama3.1.json'))

const formatted = data.map((item) => {
  return {
    prompt: item.prompt,
    text: item.text,
    rejected_text: item.rejected_text && item.rejected_text.length > 0 ? item.rejected_text : "looks good"
  }
}).filter((item) => item.text.length > 0 && item.prompt.length > 0)

console.log(`Writing ${formatted.length} of ${data.length} rows to data/train.csv, means ${data.length - formatted.length} rows were removed`)

const csv = json2csv(formatted)
fs.writeFileSync(`data/train.csv`, csv);
