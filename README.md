# typespec-opencollection

A [TypeSpec](https://typespec.io) emitter that generates [OpenCollection](https://www.opencollection.com/) YAML files — an open specification for defining executable API collections.

The generated collections can be used with any tool that supports the OpenCollection format, including [Bruno](https://www.usebruno.com/) (v3.0+).

Define your API in TypeSpec, then generate a ready-to-use collection with YAML request files, example bodies, authentication, and environment variables.

## Installation

```bash
pnpm add typespec-opencollection
```

Peer dependencies:

```bash
pnpm add @typespec/compiler @typespec/http @typespec/openapi @alloy-js/core @typespec/emitter-framework
```

## Usage

Add the emitter to your `tspconfig.yaml`:

```yaml
emit:
  - "typespec-opencollection"
```

Run:

```bash
tsp compile .
```

This generates an OpenCollection YAML directory:

```
tsp-output/typespec-opencollection/
├── opencollection.yml        # Collection root
├── environments/
│   ├── production.yml        # From @server definitions
│   └── local-development.yml
├── Pets/
│   ├── list.yml
│   ├── create.yml
│   ├── read.yml
│   ├── update.yml
│   └── remove.yml
└── Owners/
    ├── list.yml
    └── read.yml
```

Open the output directory in any OpenCollection-compatible client (e.g. Bruno v3.0+) to start making API calls.

## Features

### OpenCollection YAML Output

Each operation generates a `.yml` file following the [OpenCollection spec](https://spec.opencollection.com/):

```yaml
info:
  name: getPet
  type: http
  seq: 1
http:
  method: GET
  url: "{{baseUrl}}/pets/:petId"
  params:
    - name: petId
      value: "42"
      type: path
  auth:
    type: bearer
    token: "{{token}}"
docs: Get a pet by ID
```

### Examples from TypeSpec

The emitter uses examples in this priority order:

1. **`@opExample`** on the operation (highest priority)
2. **`@example`** on the body model type
3. **Generated placeholders** from the type structure (fallback)

```tsp
@opExample(#{
  parameters: #{
    pet: #{name: "Buddy", age: 3}
  }
})
@post op createPet(@body pet: Pet): void;
```

### Preservation of User Edits

When re-emitting, the emitter preserves `runtime` and `settings` sections from existing `.yml` files. This means tests, scripts, and assertions added in your client survive re-generation:

- **Preserved**: `runtime` (scripts, tests, assertions), `settings`
- **Regenerated**: `info`, `http`, `docs`

### Authentication

| TypeSpec | OpenCollection YAML |
|----------|-------------------|
| `@useAuth(BearerAuth)` | `auth: { type: bearer, token: ... }` |
| `@useAuth(BasicAuth)` | `auth: { type: basic, username: ..., password: ... }` |
| `@useAuth(ApiKeyAuth<...>)` | `auth: { type: apikey, key: ..., value: ... }` |

### Environments

`@server` definitions generate environment files:

```tsp
@server("https://api.example.com", "Production")
@server("http://localhost:3000", "Local")
namespace MyApi;
```

Creates `environments/production.yml` and `environments/local.yml` with `baseUrl` variables.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm sample:emit    # Generate sample collection
pnpm sample:open    # Open Bruno to load the collection
```

## License

MIT
