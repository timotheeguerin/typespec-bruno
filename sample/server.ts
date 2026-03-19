import http from "node:http";
import { createPetStoreRouter } from "./tsp-output/src/generated/http/router.js";
import type { Pet, PetCreate, PetUpdate, Owner, Pets, Owners } from "./tsp-output/src/generated/models/all/pet-store.js";
import type { ListResult, CreateResult, ReadResult, UpdateResult, RemoveResult, ListOptions } from "./tsp-output/src/generated/models/synthetic.js";

// ── In-memory data stores ──────────────────────────────────────────

let nextPetId = 1n;
const pets = new Map<bigint, Pet>();

for (const p of [
  { name: "Buddy", tag: "golden-retriever" },
  { name: "Luna", tag: "tabby" },
  { name: "Max", tag: "labrador" },
]) {
  const id = nextPetId++;
  pets.set(id, { id, name: p.name, tag: p.tag });
}

let nextOwnerId = 1n;
const owners = new Map<bigint, Owner>();
for (const o of [
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" },
]) {
  const id = nextOwnerId++;
  owners.set(id, { id, name: o.name, email: o.email });
}

// ── Service implementations ────────────────────────────────────────

// The generated synthetic.ts merges ListResult/ReadResult for Pets and Owners,
// so we use `as any` to satisfy the merged interface at the boundary.

const petsService: Pets = {
  async list(_ctx, options?: ListOptions) {
    let result = [...pets.values()];
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? result.length;
    result = result.slice(offset, offset + limit);
    return { pets: result } as any;
  },

  async create(_ctx, pet: PetCreate) {
    const id = nextPetId++;
    const newPet: Pet = { id, name: pet.name, tag: pet.tag };
    pets.set(id, newPet);
    return { _: 201 as const, pet: newPet } as any;
  },

  async read(_ctx, petId: bigint | string) {
    const id = BigInt(petId);
    const pet = pets.get(id);
    if (!pet) throw new Error(`Pet ${id} not found`);
    return { pet } as any;
  },

  async update(_ctx, petId: bigint | string, updates: PetUpdate) {
    const id = BigInt(petId);
    const pet = pets.get(id);
    if (!pet) throw new Error(`Pet ${id} not found`);
    if (updates.name !== undefined) pet.name = updates.name;
    if (updates.tag !== undefined) pet.tag = updates.tag;
    return { pet } as any;
  },

  async remove(_ctx, petId: bigint | string) {
    pets.delete(BigInt(petId));
    return { _: 204 as const };
  },
};

const ownersService: Owners = {
  async list(_ctx) {
    return { owners: [...owners.values()] } as any;
  },

  async read(_ctx, ownerId: bigint | string) {
    const id = BigInt(ownerId);
    const owner = owners.get(id);
    if (!owner) throw new Error(`Owner ${id} not found`);
    return { owner } as any;
  },
};

// ── Start server ───────────────────────────────────────────────────

const router = createPetStoreRouter(petsService, ownersService);
const server = http.createServer();

server.on("request", router.dispatch);

const port = process.env.PORT ?? 3000;
server.listen(port, () => {
  console.log(`PetStore server listening on http://localhost:${port}`);
});
