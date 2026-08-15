import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   ROUTE PARAMS
========================================= */

type RouteContext = {
  params: Promise<{
    personId: string;
  }>;
};

/* =========================================
   HELPERS
========================================= */

function normalizeString(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeNullableString(
  value: unknown
) {
  const valueString =
    normalizeString(
      value
    );

  return valueString || null;
}

function normalizeStringArray(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (item) =>
            typeof item ===
            "string"
        )
        .map(
          (item) =>
            item.trim()
        )
        .filter(Boolean)
    )
  );
}

function normalizeObject(
  value: unknown
) {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  ) {
    return value;
  }

  return {};
}

function isRelationshipState(
  value: unknown
): value is
  | "active"
  | "hiatus"
  | "dormant"
  | "potential"
  | "archived" {
  return (
    value === "active" ||
    value === "hiatus" ||
    value === "dormant" ||
    value === "potential" ||
    value === "archived"
  );
}

/* =========================================
   PATCH
   Update Person
========================================= */

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      personId,
    } =
      await context.params;

    if (!personId) {
      return NextResponse.json(
        {
          error:
            "Person ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: currentPerson,
      error: personError,
    } = await supabase
      .from("people")
      .select(`
        id,
        name,
        avatar_url,
        headline,
        company,
        city,
        phone,
        email,
        website,
        birthday,
        roles,
        tags,
        relationship_state,
        social_links,
        notes,
        metadata
      `)
      .eq(
        "id",
        personId
      )
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (
      personError ||
      !currentPerson
    ) {
      return NextResponse.json(
        {
          error:
            "Person not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await request.json();

    const nextName =
      body.name !==
        undefined
        ? normalizeString(
            body.name
          )
        : currentPerson.name;

    if (!nextName) {
      return NextResponse.json(
        {
          error:
            "Name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      nextName.length >
      255
    ) {
      return NextResponse.json(
        {
          error:
            "Name is too long.",
        },
        {
          status: 400,
        }
      );
    }

    const nextRelationshipState =
      body.relationshipState !==
        undefined
        ? body.relationshipState
        : currentPerson
            .relationship_state;

    if (
      !isRelationshipState(
        nextRelationshipState
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid relationship state.",
        },
        {
          status: 400,
        }
      );
    }

    const updates = {
      name:
        nextName,

      avatar_url:
        body.avatarUrl !==
          undefined
          ? normalizeNullableString(
              body.avatarUrl
            )
          : currentPerson
              .avatar_url,

      headline:
        body.headline !==
          undefined
          ? normalizeNullableString(
              body.headline
            )
          : currentPerson
              .headline,

      company:
        body.company !==
          undefined
          ? normalizeNullableString(
              body.company
            )
          : currentPerson
              .company,

      city:
        body.city !==
          undefined
          ? normalizeNullableString(
              body.city
            )
          : currentPerson
              .city,

      phone:
        body.phone !==
          undefined
          ? normalizeNullableString(
              body.phone
            )
          : currentPerson
              .phone,

      email:
        body.email !==
          undefined
          ? normalizeNullableString(
              body.email
            )
          : currentPerson
              .email,

      website:
        body.website !==
          undefined
          ? normalizeNullableString(
              body.website
            )
          : currentPerson
              .website,

      birthday:
        body.birthday !==
          undefined
          ? normalizeNullableString(
              body.birthday
            )
          : currentPerson
              .birthday,

      roles:
        body.roles !==
          undefined
          ? normalizeStringArray(
              body.roles
            )
          : currentPerson
              .roles,

      tags:
        body.tags !==
          undefined
          ? normalizeStringArray(
              body.tags
            )
          : currentPerson
              .tags,

      relationship_state:
        nextRelationshipState,

      social_links:
        body.socialLinks !==
          undefined
          ? normalizeObject(
              body.socialLinks
            )
          : currentPerson
              .social_links,

      notes:
        body.notes !==
          undefined
          ? normalizeNullableString(
              body.notes
            )
          : currentPerson
              .notes,

      metadata:
        body.metadata !==
          undefined
          ? normalizeObject(
              body.metadata
            )
          : currentPerson
              .metadata,

      updated_at:
        new Date().toISOString(),
    };

    const {
      data: person,
      error: updateError,
    } = await supabase
      .from("people")
      .update(
        updates
      )
      .eq(
        "id",
        personId
      )
      .eq(
        "user_id",
        user.id
      )
      .select(`
        id,
        name,
        avatar_url,
        headline,
        company,
        city,
        phone,
        email,
        website,
        birthday,
        roles,
        tags,
        relationship_state,
        social_links,
        notes,
        metadata,
        created_at,
        updated_at
      `)
      .single();

    if (
      updateError ||
      !person
    ) {
      console.error(
        "Could not update person:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "Could not update person.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        person,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas person PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected person update error.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================
   DELETE
   Delete Person

   Relationship rows cascade away.
========================================= */

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      personId,
    } =
      await context.params;

    if (!personId) {
      return NextResponse.json(
        {
          error:
            "Person ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: person,
      error: personError,
    } = await supabase
      .from("people")
      .select(`
        id,
        name
      `)
      .eq(
        "id",
        personId
      )
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (
      personError ||
      !person
    ) {
      return NextResponse.json(
        {
          error:
            "Person not found.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      error: deleteError,
    } = await supabase
      .from("people")
      .delete()
      .eq(
        "id",
        personId
      )
      .eq(
        "user_id",
        user.id
      );

    if (deleteError) {
      console.error(
        "Could not delete person:",
        deleteError
      );

      return NextResponse.json(
        {
          error:
            "Could not delete person.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        personId,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Atlas person DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected person deletion error.",
      },
      {
        status: 500,
      }
    );
  }
}