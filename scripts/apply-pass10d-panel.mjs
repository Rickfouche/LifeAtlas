import fs from "node:fs";
import path from "node:path";

const filePath =
    path.join(
        process.cwd(),
        "components",
        "atlas",
        "AtlasPanel.tsx"
    );

if (!fs.existsSync(filePath)) {
    throw new Error(
        `Could not find ${filePath}`
    );
}

let source =
    fs.readFileSync(
        filePath,
        "utf8"
    );

/*
  AtlasPanel.tsx is currently saved with Windows
  CRLF line endings. Normalize to LF so the
  surgical text matches below work reliably.
*/
source =
    source.replace(
        /\r\n/g,
        "\n"
    );

const backupPath =
    `${filePath}.pass10c-backup`;

if (
    !fs.existsSync(
        backupPath
    )
) {
    fs.copyFileSync(
        filePath,
        backupPath
    );
}

function replaceOnce(
    needle,
    replacement,
    label
) {
    const count =
        source.split(
            needle
        ).length - 1;

    if (
        count < 1
    ) {
        throw new Error(
            `PASS 10D patch could not find: ${label}`
        );
    }

    source =
        source.replace(
            needle,
            replacement
        );
}

/* -----------------------------------------
   1. Import importer component
----------------------------------------- */

replaceOnce(
`import { createClient } from "@/lib/supabase/client";

import type {`,
`import { createClient } from "@/lib/supabase/client";
import CalendarMomentImporter from "@/components/atlas/CalendarMomentImporter";

import type {`,
"CalendarMomentImporter import"
);

/* -----------------------------------------
   2. Moment add-mode state
----------------------------------------- */

replaceOnce(
`    const [
        isMomentFormOpen,
        setIsMomentFormOpen,
    ] = useState(false);

    const [
        editingMomentId,`,
`    const [
        isMomentFormOpen,
        setIsMomentFormOpen,
    ] = useState(false);

    const [
        isMomentAddMenuOpen,
        setIsMomentAddMenuOpen,
    ] = useState(false);

    const [
        isCalendarMomentImporterOpen,
        setIsCalendarMomentImporterOpen,
    ] = useState(false);

    const [
        editingMomentId,`,
"Moment add-mode state"
);

/* -----------------------------------------
   3. Reset helper closes alternate inputs
----------------------------------------- */

replaceOnce(
`    const resetMomentForm =
        () => {
            setIsMomentFormOpen(
                false
            );`,
`    const resetMomentForm =
        () => {
            setIsMomentFormOpen(
                false
            );

            setIsMomentAddMenuOpen(
                false
            );

            setIsCalendarMomentImporterOpen(
                false
            );`,
"resetMomentForm"
);

/* -----------------------------------------
   4. Manual Moment path
----------------------------------------- */

replaceOnce(
`    const openNewMomentForm =
        () => {
            setEditingMomentId(`,
`    const openNewMomentForm =
        () => {
            setIsMomentAddMenuOpen(
                false
            );

            setIsCalendarMomentImporterOpen(
                false
            );

            setEditingMomentId(`,
"openNewMomentForm"
);

/* -----------------------------------------
   5. Calendar-import merge handler
----------------------------------------- */

replaceOnce(
`    const openEditMomentForm = (
        moment: AtlasPinMoment
    ) => {`,
`    const handleCalendarMomentsImported =
        (
            importedMoments:
                AtlasPinMoment[]
        ) => {
            if (
                !selectedPin ||
                importedMoments.length ===
                    0
            ) {
                return;
            }

            const byId =
                new Map(
                    [
                        ...moments,
                        ...importedMoments,
                    ].map(
                        (moment) => [
                            moment.id,
                            moment,
                        ]
                    )
                );

            const nextMoments =
                Array.from(
                    byId.values()
                ).sort(
                    (a, b) =>
                        new Date(
                            a.start_at
                        ).getTime() -
                        new Date(
                            b.start_at
                        ).getTime()
                );

            setMoments(
                nextMoments
            );

            onMomentsChange(
                selectedPin.id,
                nextMoments
            );

            setSelectedMomentIds(
                importedMoments.map(
                    (moment) =>
                        moment.id
                )
            );
        };

    const openEditMomentForm = (
        moment: AtlasPinMoment
    ) => {`,
"Calendar import merge handler"
);

/* -----------------------------------------
   6. Plus button opens two-path chooser
----------------------------------------- */

replaceOnce(
`                                    <button
                                        type="button"
                                        className="atlas-moment-chip atlas-moment-chip--add"
                                        onClick={
                                            openNewMomentForm
                                        }
                                        aria-label="Add moment"
                                    >
                                        +
                                    </button>
                                </div>

                                {isLoadingMoments && (`,
`                                    <button
                                        type="button"
                                        className="atlas-moment-chip atlas-moment-chip--add"
                                        onClick={() => {
                                            setIsMomentAddMenuOpen(
                                                (
                                                    current
                                                ) =>
                                                    !current
                                            );

                                            setIsCalendarMomentImporterOpen(
                                                false
                                            );

                                            setIsMomentFormOpen(
                                                false
                                            );
                                        }}
                                        aria-label="Add moment"
                                        aria-expanded={
                                            isMomentAddMenuOpen
                                        }
                                    >
                                        +
                                    </button>
                                </div>

                                {isMomentAddMenuOpen && (
                                    <div className="atlas-moment-add-menu">
                                        <button
                                            type="button"
                                            onClick={
                                                openNewMomentForm
                                            }
                                        >
                                            NEW MOMENT
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsMomentAddMenuOpen(
                                                    false
                                                );

                                                setIsMomentFormOpen(
                                                    false
                                                );

                                                setIsCalendarMomentImporterOpen(
                                                    true
                                                );

                                                setMomentError(
                                                    ""
                                                );
                                            }}
                                        >
                                            FROM CALENDAR
                                        </button>
                                    </div>
                                )}

                                {isCalendarMomentImporterOpen &&
                                    selectedPin && (
                                        <CalendarMomentImporter
                                            pinId={
                                                selectedPin.id
                                            }
                                            onImported={
                                                handleCalendarMomentsImported
                                            }
                                            onCancel={() =>
                                                setIsCalendarMomentImporterOpen(
                                                    false
                                                )
                                            }
                                        />
                                    )}

                                {isLoadingMoments && (`,
"Moment plus button/render"
);

/* -----------------------------------------
   7. Close add/importer when switching Pins.
   There are two reset blocks, so patch both.
----------------------------------------- */

const pinResetNeedle =
`            setIsMomentFormOpen(
                false
            );

            setEditingMomentId(
                null
            );`;

const pinResetReplacement =
`            setIsMomentFormOpen(
                false
            );

            setIsMomentAddMenuOpen(
                false
            );

            setIsCalendarMomentImporterOpen(
                false
            );

            setEditingMomentId(
                null
            );`;

let replacedResets = 0;

while (
    source.includes(
        pinResetNeedle
    ) &&
    replacedResets < 2
) {
    source =
        source.replace(
            pinResetNeedle,
            pinResetReplacement
        );

    replacedResets += 1;
}

if (
    replacedResets < 2
) {
    console.warn(
        `PASS 10D: expected two Pin reset blocks, patched ${replacedResets}. The main Calendar flow is still installed.`
    );
}

fs.writeFileSync(
    filePath,
    source,
    "utf8"
);

console.log(
    "PASS 10D AtlasPanel patch complete."
);

console.log(
    `Backup: ${backupPath}`
);
