// Downloads the backend OpenAPI spec into src/api/openapi.json.
// The source is the spec committed on the backend dev branch; OPENAPI_SOURCE may point to another URL
// or to a local file, e.g. OPENAPI_SOURCE=../WebWallet/api/openapi.json.
import { readFile, writeFile } from 'node:fs/promises';

const source =
  process.env.OPENAPI_SOURCE ?? 'https://raw.githubusercontent.com/Andrej5768/WebWallet/dev/api/openapi.json';
const target = new URL('../src/api/openapi.json', import.meta.url);

const text = /^https?:/.test(source)
  ? await fetch(source).then((response) => {
      if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
      return response.text();
    })
  : await readFile(source, 'utf8');

// Re-serialize so the file is stable regardless of the source formatting.
await writeFile(target, JSON.stringify(JSON.parse(text), null, 2) + '\n');
console.log(`OpenAPI spec saved from ${source}`);
