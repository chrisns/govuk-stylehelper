# GOV UK Style Guide Content AI Critique

## What is this?
An attempt to use/train AI to apply the gov uk style guidelines to content submitted to it, and **learn how** to fine tune an LLM in the process.

This is a hobby/learning project, things are scrappy and not pretty, pull requests VERY welcome

It is currently configured to pull the:
- [The Government Digital Service style guide](https://www.gov.uk/guidance/style-guide/a-to-z)
- [The technical content style guide](https://www.gov.uk/guidance/style-guide/technical-content-a-to-z)

## How can I use it:
@TODO

Simply send your content in an email to: TODO@TODO.com and it'll reply shortly

## Developer guide

### Requirements

To develop fresh fine tuning data you'll need a computer with [https://ollama.com/] installed and with the [llama3.1](https://ollama.com/library/llama3.1) model already pulled (`ollama pull llama3.1`)

```bash
nvm use
npm install
npx tsx src/generate_finetunining.ts
```

This will eventually (~2hrs on my M1 Max) generate a `llama3.1.json` file which will be formatted like:
```json
[	
  {
    "prompt": "The new policy will affect farmers who are part of the EU's CAP. The UK has been part of the scheme since its inception.",
    "text": "Please ensure that the first explanation of the abbreviation 'CAP' is provided in full on this page, as per our style guide.",
    "rejected_text": "this looks fine"
  },
  ...
]
```


~~We could continue to develop locally, but I couldn't quite follow the guide at https://apeatling.com/articles/part-3-fine-tuning-your-llm-using-the-mlx-framework/ and I'd already built the training material~~

~~We're going to follow the [Cloudflare tutorial on making a LoRAs Adapter fine tuning model](https://developers.cloudflare.com/workers-ai/tutorials/fine-tune-models-with-autotrain) which means we first need to convert that JSON to a CSV.~~

```bash
# npx json2csv llama3.1.json -o data/train.csv
```

~~Now we're going to train with that so go to the [HuggingFace Autotrain workbook](https://colab.research.google.com/github/huggingface/autotrain-advanced/blob/main/colabs/AutoTrain_LLM.ipynb) you'll need some compute units if you don't have any already.~~

| ~~parameter~~    | ~~value~~                |
| ---------------- | ------------------------ |
| ~~project_name~~ | ~~`govuk-stylehelper`~~  |
| ~~model_name~~   | ~~`google/gemma-7b-it`~~ |
| ~~quantization~~ | ~~none~~                 |
| ~~lora-r~~       | ~~8~~                    |


~~Create a folder named `data` and upload the `train.csv` to that~~

~~Connect to a `A100` GPU and run the whole playbook, this will take some time, install is around 5mins, config is 0s,~~
~~I then found that I got an error~~
```bash
#AttributeError: module 'torch.library' has no #attribute 'register_fake'
```
~~so I added this beneath the pip install line~~
```python
#!pip install -U torch torchvision
```


---

## ⚠️ OK, none of that worked and I wasted £9.72 on compute credits I won't use 🤦

> Trying to follow this instead: https://huggingface.co/blog/abhishek/phi3-finetune-macbook

So our file needs formatting, if theres an empty value the autotrainer borks, so we can filter, and format to csv which will write the `data/train.csv` file

```bash
ndx tsx src/format_to_csv.ts
```


```bash
conda init zsh # if you've not already
conda create -n autotrain python=3.10
conda activate autotrain
conda install pytorch::pytorch torchvision torchaudio -c pytorch
pip install autotrain-advanced
```

You'll need your hugging face token in the env vars so it can fetch models, only needs read access

```bash
export HF_TOKEN=XXXX
```


You'll also need to get approval to use the model by agreeing to the [license agreement](https://huggingface.co/google/gemma-7b-it
) and waiting for approval, normally only takes a few minutes.

~~You'll also need to get approval to use the model by agreeing to the [license agreement](https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct) and waiting for approval, normally only takes a few minutes.~~


```bash
autotrain --config autotrainconf.yaml
```

First time it'll need to download the model (sadly it doesn't like to reuse the Ollama copy you have)

Once it gets going though, your fans should REALLY kick in, it may try to take off and you will get a very hot lap/desk/room.

Took ~35mins to run on my M1 Max

Now you need to add add `"model_type": "gemma"` to `govuk-stylehelper/adapter_config.json` you can do that easily with some jq wizardry:
```bash
jq '.model_type = "gemma"' ./govuk-stylehelper/adapter_config.json > tmp.json && mv tmp.json ./govuk-stylehelper/adapter_config.json
```


```bash
npx wrangler ai finetune create "@cf/google/gemma-7b-it-lora" govuk-stylehelper govuk-stylehelper
npx wrangler ai finetune list
```

Take note of the `finetune_id`


<!-- 
```bash
autotrain llm \
--train \
--model meta-llama/Meta-Llama-3.1-8B-Instruct \
--data-path data \
--text-column text \
--prompt-text-column prompt \
--rejected-text-column rejected_text \
--lr 2e-4 \
--lora-r 8 \
--batch-size 2 \
--quantization none \
--epochs 1 \
--trainer orpo \
--chat-template none \
--peft \
--project-name govuk-stylehelper
``` -->
