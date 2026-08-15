import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* =========================================
   ROUTE PARAMS
========================================= */

type RouteContext = {
    params: Promise<{
        pinId: string;
        taskId: string;
    }>;
};

/* =========================================
   PATCH
   Rename and/or complete a Task.

   Body can include:
   {
     title?: string,
     isComplete?: boolean
   }
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
            pinId,
            taskId,
        } =
            await context.params;

        if (
            !pinId ||
            !taskId
        ) {
            return NextResponse.json(
                {
                    error:
                        "Pin ID and Task ID are required.",
                },
                {
                    status: 400,
                }
            );
        }

        /* =========================================
           VERIFY TASK OWNERSHIP + PIN
        ========================================= */

        const {
            data: existingTask,
            error: taskError,
        } = await supabase
            .from("pin_tasks")
            .select(`
        id,
        pin_id,
        moment_id,
        title,
        is_complete
      `)
            .eq(
                "id",
                taskId
            )
            .eq(
                "pin_id",
                pinId
            )
            .eq(
                "user_id",
                user.id
            )
            .single();

        if (
            taskError ||
            !existingTask
        ) {
            return NextResponse.json(
                {
                    error:
                        "Task not found.",
                },
                {
                    status: 404,
                }
            );
        }

        const body =
            await request.json();

        const updates:
            Record<string, unknown> = {
            updated_at:
                new Date().toISOString(),
        };

        /* =========================================
           OPTIONAL TITLE UPDATE
        ========================================= */

        if (
            body.title !==
            undefined
        ) {
            const title =
                typeof body.title ===
                    "string"
                    ? body.title.trim()
                    : "";

            if (!title) {
                return NextResponse.json(
                    {
                        error:
                            "Task title cannot be empty.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            if (
                title.length > 50
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Tasks must be 50 characters or fewer.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            updates.title =
                title;
        }

        /* =========================================
           OPTIONAL COMPLETE / UNCOMPLETE
        ========================================= */

        if (
            body.isComplete !==
            undefined
        ) {
            if (
                typeof body.isComplete !==
                "boolean"
            ) {
                return NextResponse.json(
                    {
                        error:
                            "isComplete must be a boolean.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            updates.is_complete =
                body.isComplete;

            updates.completed_at =
                body.isComplete
                    ? new Date().toISOString()
                    : null;
        }

        /* =========================================
           NOTHING TO UPDATE
        ========================================= */

        if (
            updates.title ===
            undefined &&
            updates.is_complete ===
            undefined
        ) {
            return NextResponse.json(
                {
                    error:
                        "No Task changes were provided.",
                },
                {
                    status: 400,
                }
            );
        }

        /* =========================================
           UPDATE TASK
        ========================================= */

        const {
            data: task,
            error: updateError,
        } = await supabase
            .from("pin_tasks")
            .update(
                updates
            )
            .eq(
                "id",
                taskId
            )
            .eq(
                "pin_id",
                pinId
            )
            .eq(
                "user_id",
                user.id
            )
            .select(`
        id,
        pin_id,
        moment_id,
        title,
        is_complete,
        completed_at,
        created_at,
        updated_at
      `)
            .single();

        if (
            updateError ||
            !task
        ) {
            console.error(
                "Could not update Pin task:",
                updateError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not update task.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                task,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Atlas Pin task PATCH error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected task update error.",
            },
            {
                status: 500,
            }
        );
    }
}

/* =========================================
   DELETE
   Permanently remove this Task.
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
            pinId,
            taskId,
        } =
            await context.params;

        if (
            !pinId ||
            !taskId
        ) {
            return NextResponse.json(
                {
                    error:
                        "Pin ID and Task ID are required.",
                },
                {
                    status: 400,
                }
            );
        }

        /* =========================================
           VERIFY TASK
        ========================================= */

        const {
            data: task,
            error: taskError,
        } = await supabase
            .from("pin_tasks")
            .select("id")
            .eq(
                "id",
                taskId
            )
            .eq(
                "pin_id",
                pinId
            )
            .eq(
                "user_id",
                user.id
            )
            .single();

        if (
            taskError ||
            !task
        ) {
            return NextResponse.json(
                {
                    error:
                        "Task not found.",
                },
                {
                    status: 404,
                }
            );
        }

        /* =========================================
           DELETE TASK
        ========================================= */

        const {
            error: deleteError,
        } = await supabase
            .from("pin_tasks")
            .delete()
            .eq(
                "id",
                taskId
            )
            .eq(
                "pin_id",
                pinId
            )
            .eq(
                "user_id",
                user.id
            );

        if (deleteError) {
            console.error(
                "Could not delete Pin task:",
                deleteError
            );

            return NextResponse.json(
                {
                    error:
                        "Could not delete task.",
                },
                {
                    status: 500,
                }
            );
        }

        return NextResponse.json(
            {
                success: true,
                taskId,
            },
            {
                status: 200,
            }
        );
    } catch (error) {
        console.error(
            "Atlas Pin task DELETE error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Unexpected task deletion error.",
            },
            {
                status: 500,
            }
        );
    }
}