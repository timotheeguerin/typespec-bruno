import "@typespec/http";
import "@typespec/openapi";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

/** A sample pet store API */
@service
@server("https://petstore.example.com/api/v1", "Production")
@server("http://localhost:3000/api/v1", "Local development")
@useAuth(BearerAuth)
namespace PetStore;

@example(#{
  id: 1,
  name: "Buddy",
  tag: "golden-retriever",
  status: PetStatus.available,
})
model Pet {
  id: int64;
  name: string;
  tag?: string;
  status: PetStatus;
}

enum PetStatus {
  available,
  pending,
  sold,
}

@example(#{name: "Luna", tag: "tabby"})
model PetCreate {
  name: string;
  tag?: string;
}

model PetUpdate {
  name?: string;
  tag?: string;
  status?: PetStatus;
}

model Error {
  code: int32;
  message: string;
}

@route("/pets")
interface Pets {
  /** List all pets with optional filtering */
  @opExample(#{
    parameters: #{limit: 20, offset: 0},
  })
  @get list(@query limit?: int32, @query offset?: int32, @query status?: PetStatus): {
    @body pets: Pet[];
  };

  /** Create a new pet */
  @opExample(#{
    parameters: #{
      pet: #{name: "Buddy", tag: "golden-retriever"},
    },
  })
  @post create(@body pet: PetCreate): {
    @statusCode _: 201;
    @body pet: Pet;
  };

  /** Get a pet by ID */
  @opExample(#{parameters: #{petId: 42}})
  @route("{petId}")
  @get read(@path petId: int64): {
    @body pet: Pet;
  };

  /** Update a pet */
  @opExample(#{
    parameters: #{
      petId: 42,
      pet: #{name: "Buddy Jr.", status: PetStatus.pending},
    },
  })
  @route("{petId}")
  @put update(@path petId: int64, @body pet: PetUpdate): {
    @body pet: Pet;
  };

  /** Delete a pet */
  @opExample(#{parameters: #{petId: 42}})
  @route("{petId}")
  @delete remove(@path petId: int64): {
    @statusCode _: 204;
  };
}

model Owner {
  id: int64;
  name: string;
  email: string;
}

@route("/owners")
interface Owners {
  /** List all pet owners */
  @get list(): {
    @body owners: Owner[];
  };

  /** Get owner by ID */
  @opExample(#{parameters: #{ownerId: 7}})
  @route("{ownerId}")
  @get read(@path ownerId: int64): {
    @body owner: Owner;
  };
}
