# typespec-bruno

A [TypeSpec](https://typespec.io) emitter that generates [Bruno](https://www.usebruno.com/) API collections.

Define your API in TypeSpec, then generate a ready-to-use Bruno collection — complete with request files, example bodies, authentication, and environment variables.

## Installation

```bash
npm install typespec-bruno
```

Your project also needs these peer dependencies:

```bash
npm install @typespec/compiler @typespec/http @typespec/openapi
```

## Usage

### Configuration

Add the emitter to your `tspconfig.yaml`:

```yaml
emit:
  - "typespec-bruno"
options:
  typespec-bruno:
    output-dir: "{output-dir}/bruno"
```

### Run

```bash
tsp compile .
```

This generates a Bruno collection directory in your output folder:

```
tsp-output/bruno/
├── bruno.json              # Collection metadata
├── environments/
│   ├── production.bru      # From @server definitions
│   └── local-development.bru
├── Pets/
│   ├── list.bru
│   ├── create.bru
│   ├── read.bru
│   ├── update.bru
│   └── remove.bru
└── Owners/
    ├── list.bru
    └── read.bru
```

Open the output directory in Bruno to start making API calls.

## Features

### HTTP Operations → `.bru` Files

Each TypeSpec operation becomes a `.bru` file with the correct HTTP method, URL, and parameters:

```tsp
@route("/pets/{petId}")
@get op getPet(@path petId: int32, @query verbose?: boolean): Pet;
```

Generates:

```bru
meta {
  name: getPet
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/pets/:petId
  body: none
  auth: none
}

params:query {
  ~verbose: false
}

params:path {
  petId: 0
}
```

### Request Bodies

TypeSpec models are converted to example JSON bodies. The emitter uses examples in this priority order:

1. **`@opExample`** on the operation (highest priority)
2. **`@example`** on the body model type
3. **Generated placeholders** from the type structure (fallback)

#### Using `@opExample` (recommended)

```tsp
model Pet {
  name: string;
  age: int32;
}

@opExample(#{
  parameters: #{
    pet: #{name: "Buddy", age: 3}
  }
})
@post op createPet(@body pet: Pet): void;
```

Generates:

```json
{
  "name": "Buddy",
  "age": 3
}
```

#### Using `@example` on models

```tsp
@example(#{name: "Luna", age: 5})
model Pet {
  name: string;
  age: int32;
}

@post op createPet(@body pet: Pet): void;
```

Uses the model example when no `@opExample` is provided.

#### Parameter examples

`@opExample` also populates path and query parameter values:

```tsp
@opExample(#{parameters: #{petId: 42, verbose: true}})
@get op getPet(@path petId: int32, @query verbose?: boolean): Pet;
```

#### Fallback

Without any examples, placeholder values are generated from types (`string` → `"string"`, `int32` → `0`, `boolean` → `false`, etc.).

### Authentication

TypeSpec auth decorators map to Bruno auth blocks:

| TypeSpec | Bruno |
|----------|-------|
| `@useAuth(BearerAuth)` | `auth:bearer` |
| `@useAuth(BasicAuth)` | `auth:basic` |
| `@useAuth(ApiKeyAuth<...>)` | `auth:apikey` |

### Environments

`@server` definitions generate Bruno environment files:

```tsp
@server("https://api.example.com", "Production")
@server("http://localhost:3000", "Local")
namespace MyApi;
```

Creates `environments/production.bru` and `environments/local.bru` with `baseUrl` variables.

### Folder Structure

Operations are organized into folders based on TypeSpec interfaces and namespaces:

```tsp
@route("/pets")
interface Pets {
  @get list(): Pet[];
  @post create(@body pet: Pet): Pet;
}
```

Creates a `Pets/` folder with `list.bru` and `create.bru`.

## Emitter Options

| Option | Type | Description |
|--------|------|-------------|
| `output-dir` | `string` | Output directory for the Bruno collection |

## TypeSpec → Bruno Mapping Reference

| TypeSpec | Bruno |
|----------|-------|
| Service namespace | Collection root |
| Interface / sub-namespace | Subfolder |
| Operation | `.bru` request file |
| `@path` parameter | `params:path` entry |
| `@query` parameter | `params:query` entry |
| `@header` parameter | `headers` entry |
| `@body` model | `body:json` with example values |
| `@opExample` | Example values for params and body |
| `@example` on model | Example values for body (fallback) |
| `@server` | Environment file |
| `@doc` / doc comment | `docs` block |
| `@useAuth(BearerAuth)` | `auth:bearer` block |
| `@useAuth(BasicAuth)` | `auth:basic` block |
| `@useAuth(ApiKeyAuth)` | `auth:apikey` block |

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
