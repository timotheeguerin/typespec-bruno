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
  @get list(@query limit?: int32, @query offset?: int32, @query status?: PetStatus): {
    @body pets: Pet[];
  };

  /** Create a new pet */
  @post create(@body pet: PetCreate): {
    @statusCode _: 201;
    @body pet: Pet;
  };

  /** Get a pet by ID */
  @route("{petId}")
  @get read(@path petId: int64): {
    @body pet: Pet;
  };

  /** Update a pet */
  @route("{petId}")
  @put update(@path petId: int64, @body pet: PetUpdate): {
    @body pet: Pet;
  };

  /** Delete a pet */
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
  @route("{ownerId}")
  @get read(@path ownerId: int64): {
    @body owner: Owner;
  };
}
