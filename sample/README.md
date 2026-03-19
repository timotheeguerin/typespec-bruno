# Sample: PetStore API

This sample demonstrates the full workflow from TypeSpec → OpenCollection YAML → Bruno.

## Quick Start

```bash
# 1. Generate the OpenCollection YAML + server code
pnpm emit

# 2. Build (type-check)
pnpm build

# 3. Start the PetStore server
pnpm start
```

## Testing with Bruno CLI

With the server running:

```bash
pnpm test:api
```

All 7 requests run with status assertions (200/201/204).

## Testing with Bruno GUI

With the server running:

```bash
pnpm open:bruno
```

This opens the `collection/` folder in Bruno. Select the **Local** environment from the dropdown, then send any request.

### Demo walkthrough

1. **Select environment** — pick **Local** (top-right) to set `baseUrl=http://localhost:3000`
2. **Pets → list** — Send → 200 OK, returns array of pets
3. **Pets → create** — Send → 201 Created, creates a new pet
4. **Pets → read** — Send → 200 OK, returns pet by ID
5. **Pets → update** — Send → 200 OK, updates pet name
6. **Pets → remove** — Send → 204 No Content
7. **Owners → list** — Send → 200 OK, returns owners
8. Check the **Assertions** tab on any request to see `res.status eq 200` ✓

## What's generated

```
collection/
├── opencollection.yml          # Collection root
├── environments/
│   ├── local.yml               # baseUrl: http://localhost:3000
│   └── production.yml          # baseUrl: https://petstore.example.com
├── Pets/
│   ├── list.yml                # GET /pets
│   ├── create.yml              # POST /pets
│   ├── read.yml                # GET /pets/:petId
│   ├── update.yml              # PUT /pets/:petId
│   └── remove.yml              # DELETE /pets/:petId
└── Owners/
    ├── list.yml                # GET /owners
    └── read.yml                # GET /owners/:ownerId
```

## Demo recording

![Demo](demo.gif)
